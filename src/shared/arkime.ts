/* eslint-disable prettier/prettier */
/**
 * Shared Arkime controller.
 *
 * When a simulation starts, an Arkime stack is brought up on the host with
 * plain `docker` (no compose, so we can mix static and per-machine containers):
 *
 *   - cri40-arkime-opensearch : OpenSearch single-node (host net, :9200)
 *   - cri40-arkime-viewer     : Arkime viewer web UI (host net, :8005)
 *   - cri40-arkime-cap-<name> : one Arkime capture per lab machine, launched
 *                               with `--net=container:<kathara_container>` so it
 *                               shares that machine's network namespace and
 *                               sniffs `-i any`.
 *
 * The Kathara lab links (10.x) live in userspace VDE switches and are invisible
 * on the host, so a host-side single-interface capture (as in the reference
 * podman setup) would miss all inter-machine traffic. Capturing inside each
 * machine's netns records everything that machine sends or receives.
 *
 * The viewer is embedded in the CRI4.0 UI: the "Statistics" tab shows its home
 * page, and a machine's "Net Flow" modal shows /sessions filtered by that
 * machine's IPs.
 */
import { exec, spawn } from 'child_process';
import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';

// The Arkime viewer listens here, but it is NOT embedded directly: it sends
// X-Frame-Options: DENY and a SameSite=Strict auth cookie. Instead the app's own
// origin proxies it under /arkime/ (webBasePath below) — same-origin so the
// cookie is first-party, with the framing headers stripped by the proxy. See the
// `/arkime` entries in the dev-server config and the Express server.
const ARKIME_VIEWER_PORT = 8005;
// The path the viewer is served under (must match webBasePath in its config and
// the reverse-proxy route). Kept relative so the iframe is always same-origin
// with the CRI4.0 app, in both Electron and web mode.
export const ARKIME_BASE_PATH = '/arkime';
const OPENSEARCH_PORT = 9200;

// Reachable from inside a Kathara container (which has an interface on docker0):
// the docker bridge gateway is the host, where OpenSearch is published.
const HOST_FROM_CONTAINER = '172.17.0.1';

// Loki (collector) is bridged to the host, so a "ready" ping can be pushed here.
const LOKI_PORT = 3100;

const OPENSEARCH_IMAGE = 'opensearchproject/opensearch:2';
const ARKIME_IMAGE = 'ghcr.io/arkime/arkime/arkime:v6-latest';

const OPENSEARCH_NAME = 'cri40-arkime-opensearch';
const VIEWER_NAME = 'cri40-arkime-viewer';
const CAP_PREFIX = 'cri40-arkime-cap-';
// A fixed hostname shared by the viewer (--host) and every capture (--host) so
// Arkime's isLocalView() treats all per-machine capture nodes as local: the
// single viewer then reads their pcap straight from the shared raw/ volume
// instead of trying to proxy to a per-node viewer that doesn't exist. This is
// what makes the packet/tcpflow ("Show Packets") view work.
const ARKIME_VIEW_HOST = 'cri40-arkime';

// Host paths bind-mounted into the containers (writable without sudo).
const BASE_DIR = path.join(os.homedir(), '.cri40', 'arkime');
const ETC_DIR = path.join(BASE_DIR, 'etc');
const RAW_DIR = path.join(BASE_DIR, 'raw');
const CONFIG_PATH = path.join(ETC_DIR, 'config.ini');

type Logger = (level: 'log' | 'error' | 'warn' | 'info' | 'debug', message: string) => void;

// The static infrastructure (OpenSearch + viewer) is brought up once at platform
// startup and stays up across simulations. Per-machine captures come and go with
// each simulation and are tracked only by their running containers.
let infraStarting = false;
let infraUp = false;

function sh(cmd: string, timeoutMs = 60_000): Promise<{ code: number; out: string; err: string }> {
	return new Promise((resolve) => {
		exec(cmd, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
			resolve({ code: error && typeof (error as any).code === 'number' ? (error as any).code : error ? 1 : 0, out: stdout || '', err: stderr || '' });
		});
	});
}

/**
 * Run `docker` with an explicit argv array (no host shell), so arguments like a
 * `sh -c '<script with $(...) and $i>'` payload are passed verbatim to the
 * container instead of being expanded by the host shell first.
 */
function dockerRun(args: string[], timeoutMs = 120_000): Promise<{ code: number; out: string; err: string }> {
	return new Promise((resolve) => {
		const p = spawn('docker', args);
		let out = '';
		let err = '';
		const timer = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* ignore */ } }, timeoutMs);
		p.stdout.on('data', (d) => { out += d.toString(); });
		p.stderr.on('data', (d) => { err += d.toString(); });
		p.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, out, err }); });
		p.on('error', (e) => { clearTimeout(timer); resolve({ code: 1, out, err: String(e) }); });
	});
}

function configIni(): string {
	return [
		'[default]',
		`elasticsearch=http://localhost:${OPENSEARCH_PORT}`,
		'interface=any',
		'pcapDir=/opt/arkime/raw',
		// 64K snaplen tolerates GRO/GSO-coalesced packets so capture doesn't die
		// with "Arkime requires full packet captures" if offloading isn't fully off.
		'snapLen=65536',
		'pcapReadMethod=libpcap',
		// Write pcap uncompressed so packets hit disk immediately — with the
		// default zstd compression small flows stay buffered and the tcpflow view
		// shows "No pcap data found" until a whole block accumulates.
		'simpleCompression=none',
		'packetThreads=1',
		'authMode=anonymous',
		`viewPort=${ARKIME_VIEWER_PORT}`,
		'viewHost=0.0.0.0',
		// Serve the viewer under /arkime/ so the app can reverse-proxy it on its
		// own origin (keeps the SameSite=Strict auth cookie first-party).
		`webBasePath=${ARKIME_BASE_PATH}/`,
		'maxFileSizeG=1',
		'freeSpaceG=1',
		'',
	].join('\n');
}

export function isArkimeRunning(): boolean {
	return infraUp;
}

/** List running Kathara lab containers (excluding the collector infrastructure). */
async function labContainers(): Promise<string[]> {
	const { out } = await sh(`docker ps --filter name=kathara_ --format "{{.Names}}"`);
	return out
		.split('\n')
		.map((s) => s.trim())
		.filter(Boolean)
		.filter((n) => !n.includes('_collector_') && !n.includes('_collectordb_'));
}

/** Map a kathara container name to the lab machine name embedded in it. */
function machineNameOf(containerName: string): string {
	// kathara_<user-hash>_<machine>_<lab-hash>
	const parts = containerName.split('_');
	return parts.length >= 3 ? parts[parts.length - 2] : containerName;
}

async function waitForOpenSearch(log: Logger, attempts = 40): Promise<boolean> {
	for (let i = 0; i < attempts; i++) {
		const { code } = await sh(`curl -s -o /dev/null http://localhost:${OPENSEARCH_PORT}`, 5000);
		if (code === 0) return true;
		await new Promise((r) => setTimeout(r, 3000));
	}
	log('warn', '🦈 OpenSearch did not become ready in time.');
	return false;
}

/**
 * Bring up the static Arkime infrastructure (OpenSearch + DB + viewer). This is
 * started once at platform startup and stays up across simulations, so the
 * Statistics viewer is always reachable. Idempotent: repeated calls are no-ops
 * while it is up or coming up. Does NOT attach per-machine captures — that
 * happens per simulation via startArkimeCapture(). Fire-and-forget: the first
 * run pulls images and can take minutes, so callers don't await it.
 */
export async function startArkimeInfra(log: Logger): Promise<void> {
	if (infraUp || infraStarting) {
		log('log', '🦈 Arkime infrastructure already running, skipping start.');
		return;
	}
	infraStarting = true;
	try {
		fs.mkdirSync(ETC_DIR, { recursive: true });
		fs.mkdirSync(RAW_DIR, { recursive: true });
		fs.writeFileSync(CONFIG_PATH, configIni());
		// Capture writes pcap here as root inside the container; keep it open.
		try { fs.chmodSync(RAW_DIR, 0o777); } catch { /* ignore */ }

		// Clean any leftovers from a previous process (captures + infra).
		await stopArkimeContainers();

		log('log', '🦈 Starting OpenSearch (first run pulls images, may take a while)...');
		await sh(
			`docker run -d --name ${OPENSEARCH_NAME} --network host ` +
			`-e discovery.type=single-node -e plugins.security.disabled=true ` +
			`-e "OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m" -e bootstrap.memory_lock=true ` +
			`-e "OPENSEARCH_INITIAL_ADMIN_PASSWORD=Cri40Arkime!23" ` +
			`${OPENSEARCH_IMAGE}`,
			300_000,
		);

		if (!(await waitForOpenSearch(log))) {
			infraStarting = false;
			return;
		}
		log('log', '🦈 OpenSearch ready, initialising Arkime DB...');

		// db.pl asks for confirmation only if indices already exist; feed "INIT".
		await sh(
			`printf 'INIT\\n' | docker run -i --rm --network host ` +
			`-v ${ETC_DIR}:/opt/arkime/etc ${ARKIME_IMAGE} ` +
			`/opt/arkime/db/db.pl --insecure http://localhost:${OPENSEARCH_PORT} init`,
			300_000,
		);

		log('log', `🦈 Starting Arkime viewer on :${ARKIME_VIEWER_PORT}...`);
		// The viewer has no standalone binary — it runs via the image's docker.sh
		// wrapper (node viewer.js), reading /opt/arkime/etc/config.ini.
		await sh(
			`docker run -d --name ${VIEWER_NAME} --network host ` +
			`-v ${ETC_DIR}:/opt/arkime/etc -v ${RAW_DIR}:/opt/arkime/raw ` +
			`${ARKIME_IMAGE} /opt/arkime/bin/docker.sh viewer --host ${ARKIME_VIEW_HOST}`,
			120_000,
		);

		infraUp = true;
		infraStarting = false;
		log('log', '🦈 Arkime infrastructure up.');
		pushLokiReady(log);
	} catch (e: any) {
		infraStarting = false;
		log('error', `🦈 Failed to start Arkime infrastructure: ${e?.message || e}`);
	}
}

/**
 * Attach one Arkime capture sidecar per current lab machine, each inside its
 * network namespace. Any capture sidecars left over from a previous simulation
 * are removed first, so this doubles as the "start capturing the new lab" step.
 * If the infrastructure isn't up yet (simulation started before boot finished),
 * it is brought up on demand.
 */
export async function startArkimeCapture(log: Logger): Promise<void> {
	if (!infraUp) {
		await startArkimeInfra(log);
		if (!infraUp) return;
	}

	// Never double-attach: drop capture sidecars from a previous simulation.
	await stopCaptureContainers();

	const containers = await labContainers();
	if (containers.length === 0) {
		log('warn', '🦈 No lab containers found to capture.');
		return;
	}
	for (const c of containers) {
		const machine = machineNameOf(c);
		log('log', `🦈 Attaching capture to ${machine}...`);
		// Disable NIC offloading on the machine's interfaces first: with GRO/GSO
		// on, the kernel hands libpcap super-sized packets (tens of KB) that
		// exceed snapLen and Arkime drops them. `docker.sh` does this via
		// arkime_config_interfaces.sh, but that keys off a named interface and
		// we capture on "any", so we loop over the netns interfaces ourselves.
		// cwd=/opt/arkime so capture finds ./parsers. Passed as a single argv
		// element (dockerRun uses spawn, no host shell) so the $(...)/$i stay
		// intact for the container's shell.
		const captureCmd =
			`for i in $(ls /sys/class/net); do [ "$i" = lo ] && continue; ` +
			`ethtool -K "$i" gro off gso off tso off lro off rx off tx off 2>/dev/null; done; ` +
			// --host matches the viewer's --host so the viewer treats this node's
			// pcap as local and serves the packet/tcpflow view from the shared disk.
			`exec /opt/arkime/bin/capture -c /opt/arkime/etc/config.ini ` +
			`-n ${machine} --host ${ARKIME_VIEW_HOST} ` +
			`-o elasticsearch=http://${HOST_FROM_CONTAINER}:${OPENSEARCH_PORT}`;
		const { code, err } = await dockerRun([
			'run', '-d', '--name', `${CAP_PREFIX}${machine}`, `--net=container:${c}`,
			'--cap-add=NET_RAW', '--cap-add=NET_ADMIN', '-w', '/opt/arkime',
			'-v', `${ETC_DIR}:/opt/arkime/etc`, '-v', `${RAW_DIR}:/opt/arkime/raw`,
			ARKIME_IMAGE, 'sh', '-c', captureCmd,
		]);
		if (code !== 0) log('warn', `🦈 capture for ${machine} failed: ${err.trim()}`);
	}
	log('log', '🦈 Arkime captures attached.');
}

/**
 * Empty all captured traffic without tearing down the infrastructure: detach the
 * capture sidecars, wipe the Arkime session/SPI indices (re-running db.pl init,
 * the same known-good path used at boot) and clear the on-disk pcap. Called on
 * every simulation (re)start so each run begins with a clean slate.
 */
export async function resetArkimeData(log: Logger): Promise<void> {
	if (!infraUp) return;
	log('log', '🦈 Emptying Arkime capture data...');
	// Captures must be detached before wiping so nothing writes during the reset.
	await stopCaptureContainers();

	// Re-init drops and recreates the session/SPI indices. db.pl prompts for
	// confirmation because the indices already exist; feed "INIT".
	await sh(
		`printf 'INIT\\n' | docker run -i --rm --network host ` +
		`-v ${ETC_DIR}:/opt/arkime/etc ${ARKIME_IMAGE} ` +
		`/opt/arkime/db/db.pl --insecure http://localhost:${OPENSEARCH_PORT} init`,
		300_000,
	);

	// Remove leftover pcap files so old packets don't linger on disk.
	try {
		for (const f of fs.readdirSync(RAW_DIR)) {
			try { fs.rmSync(path.join(RAW_DIR, f), { recursive: true, force: true }); } catch { /* ignore */ }
		}
	} catch { /* ignore */ }
	log('log', '🦈 Arkime capture data emptied.');
}

/** Remove just the per-machine capture sidecars. */
async function stopCaptureContainers(): Promise<void> {
	const { out } = await sh(`docker ps -aq --filter name=${CAP_PREFIX}`);
	const capIds = out.split('\n').map((s) => s.trim()).filter(Boolean);
	if (capIds.length) await sh(`docker rm -f ${capIds.join(' ')}`);
}

async function stopArkimeContainers(): Promise<void> {
	// Remove per-machine capture sidecars first, then viewer + opensearch.
	await stopCaptureContainers();
	await sh(`docker rm -f ${VIEWER_NAME} ${OPENSEARCH_NAME}`);
}

/** Detach the per-machine captures, leaving the infrastructure running. */
export async function stopArkimeCapture(log: Logger): Promise<void> {
	log('log', '🦈 Detaching Arkime captures...');
	await stopCaptureContainers();
}

/** Full teardown of the whole Arkime stack (infra + captures). Used on exit. */
export async function stopArkime(log: Logger): Promise<void> {
	if (!infraUp && !infraStarting) return;
	log('log', '🦈 Stopping Arkime stack...');
	await stopArkimeContainers();
	infraUp = false;
	infraStarting = false;
}

/** Push a "ready" line to Loki so Arkime shows up like the other machines. */
function pushLokiReady(log: Logger): void {
	const body = JSON.stringify({
		streams: [
			{
				stream: { job: 'job', level: 'info', host: 'arkime' },
				values: [[String(Date.now() * 1_000_000), JSON.stringify({ message: 'ready' })]],
			},
		],
	});
	const req = http.request(
		{
			host: '127.0.0.1',
			port: LOKI_PORT,
			path: '/loki/api/v1/push',
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
			timeout: 4000,
		},
		(res) => res.resume(),
	);
	req.on('timeout', () => req.destroy());
	req.on('error', (e) => log('warn', `🦈 Loki ready push failed: ${e.message}`));
	req.write(body);
	req.end();
}

// Default expression for the Statistics tab: show all traffic (ip == 0.0.0.0/0)
// but drop the docker-bridge noise on 172.x (ip != 172.0.0.0/8), loopback
// (ip != 127.0.0.1) and the collector/infrastructure node (ip != 10.1.0.254).
// Arkime carries the `expression` query param across its views, so it applies
// as the starting filter for the embedded viewer.
const STATS_DEFAULT_EXPRESSION = '(ip != 172.0.0.0/8) && (ip != 127.0.0.1) && (ip == 0.0.0.0/0) && (ip != 10.1.0.254)';

export type ArkimeViewUrls = {
	general: string;
	sessions: string;
	packets: string;
	connections: string;
};

// Relative (same-origin) URLs under the app's /arkime reverse-proxy, one per
// Statistics sub-tab. Being same-origin is what keeps Arkime's SameSite=Strict
// auth cookie working inside the iframe; the browser resolves them against the
// CRI4.0 app origin. The default expression is carried on every view so the
// docker-bridge noise is filtered out from the start. `general` points at
// Arkime's own overview page (route /arkime, i.e. /arkime/arkime under the base
// path) rather than the bare base path, which just redirects and drops the
// query string.
export function arkimeViewUrls(): ArkimeViewUrls {
	const expr = `expression=${encodeURIComponent(STATS_DEFAULT_EXPRESSION)}`;
	return {
		general: `${ARKIME_BASE_PATH}/arkime?${expr}`,
		sessions: `${ARKIME_BASE_PATH}/sessions?${expr}`,
		packets: `${ARKIME_BASE_PATH}/spiview?${expr}`,
		connections: `${ARKIME_BASE_PATH}/connections?${expr}`,
	};
}

/**
 * Arkime /sessions URL filtered to traffic that involves any of the given IPs.
 * Arkime's `ip ==` matches both source and destination, so a single term per
 * IP covers inbound, outbound and forwarded traffic for that machine.
 */
export function arkimeSessionsUrl(ips: string[]): string {
	const clean = Array.from(new Set((ips || []).map((s) => String(s).split('/')[0].trim()).filter(Boolean)));
	if (clean.length === 0) return `${ARKIME_BASE_PATH}/sessions`;
	const expression = clean.map((ip) => `ip == ${ip}`).join(' || ');
	return `${ARKIME_BASE_PATH}/sessions?expression=${encodeURIComponent(expression)}`;
}
