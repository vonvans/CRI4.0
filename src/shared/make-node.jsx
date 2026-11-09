// src/shared/make-node.js
import AdmZip from "adm-zip";
import {
  MAIN_CONFIGS,
  NETSTREAM_PORT,
  isHolderDevice,
  isPhysicalSim,
  isPeripheral,
  getPhysSimIp,
} from "../renderer/utils/deviceAutoCreate";

/** ───────────────── Helpers identici al renderer (adattati a Node) ───────────────── */

function parseVolumeSrc(src) {
  const colonIdx = src.lastIndexOf(':');
  if (colonIdx > 0) {
    const maybeOpt = src.slice(colonIdx + 1);
    if (!maybeOpt.includes('/')) {
      return { path: src.slice(0, colonIdx), opts: maybeOpt };
    }
  }
  return { path: src, opts: '' };
}

function buildCriTargets(machine) {
  const targets = machine.targets || [];
  const result = [];
  for (const t of targets) {
    if (!t || !t.interfaces || !Array.isArray(t.interfaces.if)) continue;
    let ip = null;
    if (t.selectedInterfaceIp) {
      ip = t.selectedInterfaceIp;
    } else {
      const validIfaces = t.interfaces.if.filter(
        i => i && i.eth && i.eth.domain !== "_collector" && i.ip
      );
      if (validIfaces.length > 0) {
        ip = String(validIfaces[0].ip).split('/')[0].trim();
      }
    }
    if (ip) result.push({ name: t.name || "", address: ip });
  }
  return JSON.stringify(result);
}

function buildCriInterfaces(machine) {
  const ifaces = [];
  if (machine.computedEth0Ip) {
    ifaces.push({ name: "eth0", address: machine.computedEth0Ip });
  }
  if (machine.interfaces && Array.isArray(machine.interfaces.if)) {
    for (const iface of machine.interfaces.if) {
      if (iface && iface.eth && iface.eth.number >= 1 && typeof iface.ip === "string" && iface.ip.trim() !== "") {
        let addr = iface.ip.trim();
        if (!addr.includes("/")) addr += "/24";
        ifaces.push({ name: `eth${iface.eth.number}`, address: addr });
      }
    }
  }
  return JSON.stringify(ifaces);
}

// Extract the Modbus endpoints exposed by a "device" machine from its
// uploaded peripheral configs (one Modbus server per config, port from
// modbus_bind, registers from the variables map). Mirrors the default
// scenario baked into icr/device when no configs were uploaded.
function getDeviceModbusEndpoints(machine) {
  const MAIN_CONFIGS = ["simulation.json", "gateway.json", "visualization.json"];
  const configs = (machine.device?.configs || []).filter(
    (c) => c?.name && c?.content && !MAIN_CONFIGS.includes(c.name)
  );

  // The physics simulator only serves the scenario configs, no Modbus servers.
  if (isPhysicalSim(machine)) return [];

  if (configs.length === 0) {
    return [
      {
        name: "temp_sensor", deviceType: "TempSensor", port: 1502,
        variables: [{ name: "reactor_temp", register: 100, kind: "input", type: "uint16" }],
      },
      {
        name: "valve_actuator", deviceType: "ValveActuator", port: 1503,
        variables: [
          { name: "target_pos", register: 200, kind: "holding", type: "uint16" },
          { name: "actual_pos", register: 201, kind: "holding", type: "uint16" },
        ],
      },
    ];
  }

  const endpoints = [];
  for (const cfg of configs) {
    try {
      const raw = String(cfg.content).split(";base64,").pop();
      const json = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
      if (!json.modbus_bind) continue;
      const port = parseInt(String(json.modbus_bind).split(":").pop(), 10);
      if (!port) continue;
      const variables = Object.entries(json.variables || {})
        .filter(([, v]) => v?.modbus)
        .map(([varName, v]) => ({
          name: varName,
          register: v.modbus.address,
          kind: v.modbus.kind || "input",
          type: v.modbus.type || "uint16",
        }));
      endpoints.push({
        name: cfg.name.replace(/\.json$/i, "").replace(/[^\w.-]/g, "_"),
        deviceType: json.device_type || "unknown",
        port,
        variables,
      });
    } catch (e) {
      console.error(`Failed to parse device config ${cfg.name}`, e);
    }
  }
  return endpoints;
}

function makeMachineFolders(netkit, lab) {
  for (let machine of netkit) lab.folders.push(machine.name);
}

/*function makeStartupFiles(netkit, lab) {
  lab.file["collector.startup"] = "";
  lab.file["collectordb.startup"] = "";
  for (let machine of netkit) {
    //if (machine.name && machine.name !== "") {
      //lab.file[machine.name + ".startup"] = "";
    //}
     const rawName = machine.type === "attacker" ? (machine.name || "attacker") : machine.name;
    const machineName = String(rawName).replace(/[^\w.-]/g, "_");

    // prendi lo script dal nuovo campo, fallback al vecchio
    const userScript =
      (machine.scripts && typeof machine.scripts.startup === "string"
        ? machine.scripts.startup
        : "") ||
      (machine.interfaces && typeof machine.interfaces.free === "string"
        ? machine.interfaces.free
        : "");

    // header sicuro + script utente (trim) + newline finale
    const header = `#!/bin/bash
set -euo pipefail

`;
    const body = (userScript || "").trim();
    lab.file[`${machineName}.startup`] = header + ipSetup + body + "\n";

  }
}*/

function makeStartupFiles(netkit, lab) {
  lab.file["collector.startup"] = "";
  lab.file["collectordb.startup"] = "";

  // 1. Pre-calculate IPs for all machines (needed for PLC to know other machines' IPs)
  let collectorIpCounter = 1; // New counter for 10.1.0.X subnet

  for (let machine of netkit) {
    // Config holders are not deployed: they only hold the uploaded scenario.
    if (machine.type === "device" && isHolderDevice(machine)) continue;
    const rawName = machine.type === "attacker" ? (machine.name || "attacker") : machine.name;
    const machineName = String(rawName || "node").replace(/[^\w.-]/g, "_");

    // Assign IP to eth0 from 10.1.0.0/24 subnet
    let eth0Ip;
    if (machineName === "collector") {
      eth0Ip = "10.1.0.254/24"; // Dedicated IP for the collector
    } else if (machineName === "collectordb") {
      eth0Ip = "10.1.0.253/24"; // Dedicated IP for the collector DB
    } else {
      // Check if eth0 is already configured in interfaces
      const eth0Interface = machine.interfaces?.if?.find(i => i.eth?.number === 0);
      if (eth0Interface && eth0Interface.ip) {
        eth0Ip = eth0Interface.ip;
        // Ensure it has CIDR
        if (!eth0Ip.includes('/')) eth0Ip += '/24';
      } else {
        eth0Ip = `10.1.0.${collectorIpCounter}/24`;
        collectorIpCounter++;
      }
    }
    machine.computedEth0Ip = eth0Ip; // Store for later use
  }

  // 2. Generate startup files
  for (let machine of netkit) {
    // Config holders are not deployed: skip their startup generation.
    if (machine.type === "device" && isHolderDevice(machine)) continue;
    const rawName = machine.type === "attacker" ? (machine.name || "attacker") : machine.name;
    const machineName = String(rawName || "node").replace(/[^\w.-]/g, "_");

    // prendi lo script dal nuovo campo, fallback al vecchio
    const userScript =
      (machine.scripts && typeof machine.scripts.startup === "string"
        ? machine.scripts.startup
        : "") ||
      (machine.interfaces && typeof machine.interfaces.free === "string"
        ? machine.interfaces.free
        : "");

    // header sicuro
    let header = "#!/bin/bash\nset -euo pipefail\n\n";
    header += "echo \"nameserver 8.8.8.8\" > /etc/resolv.conf\n";
    let ipSetup = "";

    // Use pre-calculated IP
    const eth0Ip = machine.computedEth0Ip;
    ipSetup += `ip addr add ${eth0Ip} dev eth0\nip link set eth0 up\n`;

    // Assign IPs to eth1 and subsequent interfaces from frontend
    if (machine.interfaces && Array.isArray(machine.interfaces.if)) {
      for (const iface of machine.interfaces.if) {
        if (iface && iface.eth && iface.eth.number >= 1 && typeof iface.ip === "string" && iface.ip.trim() !== "") {
          const interfaceNumber = iface.eth.number;
          let ipAddress = String(iface.ip).trim();
          if (!ipAddress.includes("/")) {
            ipAddress += "/24";
          }
          ipSetup += `ip addr add ${ipAddress} dev eth${interfaceNumber}\nip link set eth${interfaceNumber} up\n`;
        }
      }
    }
    const body = (userScript || "").trim();

    // "other" machines can be any image (archlinux, alpine, custom, …)
    // Use a minimal POSIX sh script without assumptions about the image's tools.
    if (machine.type === "other") {
      let otherScript;

      // A "complete" script is one generated by generateCustomStartupScript — it
      // starts with a shebang and already contains network setup + smoloki signal.
      // Detect it by the shebang so the check survives even if customTemplateId
      // gets lost (e.g. user clicks another radio button accidentally).
      const isCompleteScript = body.startsWith("#!/");

      if (isCompleteScript) {
        otherScript = body.replace(/<eth0_ip>/g, eth0Ip);
      } else {
        otherScript = "#!/bin/sh\n\n";

        // ── 1. Network setup ─────────────────────────────────────────────────
        otherScript += "echo 'nameserver 8.8.8.8' > /etc/resolv.conf 2>/dev/null || true\n";
        otherScript += `ip addr add ${eth0Ip} dev eth0 2>/dev/null || true\n`;
        otherScript += "ip link set eth0 up 2>/dev/null || true\n";
        if (machine.interfaces && Array.isArray(machine.interfaces.if)) {
          for (const iface of machine.interfaces.if) {
            if (iface && iface.eth && iface.eth.number >= 1 && typeof iface.ip === "string" && iface.ip.trim() !== "") {
              const interfaceNumber = iface.eth.number;
              let ipAddress = String(iface.ip).trim();
              if (!ipAddress.includes("/")) ipAddress += "/24";
              otherScript += `ip addr add ${ipAddress} dev eth${interfaceNumber} 2>/dev/null || true\n`;
              otherScript += `ip link set eth${interfaceNumber} up 2>/dev/null || true\n`;
            }
          }
        }

        // ── 2. User startup script ───────────────────────────────────────────
        if (body) otherScript += "\n" + body + "\n";

        // ── 3. Signal readiness ──────────────────────────────────────────────
        otherScript += "\nexport PATH=\"$HOME/.local/bin:$HOME/.cargo/bin:$PATH\"\n";
        otherScript += "smoloki -b http://10.1.0.254:3100 '{\"job\":\"test\",\"level\":\"info\", \"host\": \"'\"$(hostname)\"'\"}' '{\"message\":\"ready\"}' 2>/dev/null || true\n";
      }

      // ── Inject env vars right after the shebang ─────────────────────────
      // CRI_INTERFACES (JSON) cannot go in lab.conf [env] because Kathara's
      // parser rejects double-quoted values that contain double quotes.
      // Instead, write it to /root/.cri_env via heredoc (no quoting issues)
      // and source that file from /root/.bashrc — docker exec -it /bin/bash
      // opens an interactive bash which sources ~/.bashrc.
      // Manifest field values are already set via Docker -e (lab.conf [env]);
      // /etc/environment writes below are a fallback for non-bash shells.
      const criJson = buildCriInterfaces(machine);
      const safeJson = criJson.replace(/'/g, "'\\''");

      // 1. export inline — makes $CRI_INTERFACES available to the startup script body
      // 2. write /root/.cri_env + source from .bashrc — makes it visible via `env`
      //    in interactive shells opened with docker exec -it /bin/bash
      const criBlock = [
        `export CRI_INTERFACES='${safeJson}'`,
        `cat > /root/.cri_env << '__CRI_ENV_EOF__'`,
        `export CRI_INTERFACES='${safeJson}'`,
        `__CRI_ENV_EOF__`,
        `grep -qxF '. /root/.cri_env' /root/.bashrc 2>/dev/null || echo '. /root/.cri_env' >> /root/.bashrc`,
      ].join("\n") + "\n";

      const fieldEnvLines = Object.entries(machine.other?.fields || {})
        .filter(([key, field]) => key && field.value !== undefined && field.value !== "")
        .map(([key, field]) => `echo '${String(key).replace(/'/g, "'\\''")}=${String(field.value).replace(/'/g, "'\\''")}' >> /etc/environment 2>/dev/null || true`);

      const injectedBlock = criBlock + (fieldEnvLines.length > 0 ? fieldEnvLines.join("\n") + "\n" : "");
      otherScript = otherScript.replace(/^(#![^\n]*\n)/, (_, shebang) => shebang + injectedBlock);

      lab.file[`${machineName}.startup`] = otherScript;
      continue;
    }

    if (machine.type === "attacker") {
      // Treat the auto-generated attacker startup as NOT complete so we fall back
      // to the baked, POSIX-sh, jq-free interface setup below. Older projects have
      // a saved startup that uses a bash `for (( ))` loop under `#!/bin/sh`; on
      // dash-based images that is a syntax error that aborts the script before the
      // interfaces are configured or the "ready" signal is sent, so the node never
      // goes green. The `for ((` marker auto-migrates those saved scripts.
      const isCompleteScript = body.startsWith("#!/") && !body.includes("for ((");
      let attackerScript;

      if (isCompleteScript) {
        attackerScript = body.replace(/<eth0_ip>/g, eth0Ip);
      } else {
        // Assign each interface IP with an explicit `ip addr add` instead of a
        // jq/bash loop over $CRI_INTERFACES: some attacker images (e.g.
        // icr/access-gain-crack-plc) ship without `jq`, which made the loop
        // produce an empty length and leave eth0/eth1 with no IP. make-node
        // already knows the interfaces via buildCriInterfaces, so we bake the
        // commands in directly — POSIX-sh safe, works on any image.
        const ifaceCmds = JSON.parse(buildCriInterfaces(machine))
          .map((i) =>
            `ip addr add ${i.address} dev ${i.name} 2>/dev/null || true\n` +
            `ip link set ${i.name} up 2>/dev/null || true`
          )
          .join("\n");
        attackerScript = `#!/bin/sh

${ifaceCmds}

smoloki -b http://10.1.0.254:3100 '{"job":"test","level":"info","host":"'"$(hostname)"'"}' '{"message":"ready"}' 2>/dev/null || true
`;
      }

      const criJson = buildCriInterfaces(machine);
      const safeJson = criJson.replace(/'/g, "'\\''");
      const targetsJson = buildCriTargets(machine);
      const safeTargetsJson = targetsJson.replace(/'/g, "'\\''");
      const criBlock = [
        `export CRI_INTERFACES='${safeJson}'`,
        `export CRI_TARGETS='${safeTargetsJson}'`,
        `cat > /root/.cri_env << '__CRI_ENV_EOF__'`,
        `export CRI_INTERFACES='${safeJson}'`,
        `export CRI_TARGETS='${safeTargetsJson}'`,
        `__CRI_ENV_EOF__`,
        `grep -qxF '. /root/.cri_env' /root/.bashrc 2>/dev/null || echo '. /root/.cri_env' >> /root/.bashrc`,
      ].join("\n") + "\n";

      const fieldEnvLines = Object.entries(machine.attacker?.fields || {})
        .filter(([key, field]) => key && field.value !== undefined && field.value !== "")
        .map(([key, field]) => `echo '${String(key).replace(/'/g, "'\\''")}=${String(field.value).replace(/'/g, "'\\''")}' >> /etc/environment 2>/dev/null || true`);

      const injectedBlock = criBlock + (fieldEnvLines.length > 0 ? fieldEnvLines.join("\n") + "\n" : "");
      attackerScript = attackerScript.replace(/^(#![^\n]*\n)/, (_, shebang) => shebang + injectedBlock);

      lab.file[`${machineName}.startup`] = attackerScript;
      continue;
    }

    if (machine.type === "mosquitto") {
      const criJson = buildCriInterfaces(machine);
      const safeJson = criJson.replace(/'/g, "'\\''");
      const criBlock = [
        `export CRI_INTERFACES='${safeJson}'`,
        `cat > /root/.cri_env << '__CRI_ENV_EOF__'`,
        `export CRI_INTERFACES='${safeJson}'`,
        `__CRI_ENV_EOF__`,
        `grep -qxF '. /root/.cri_env' /root/.bashrc 2>/dev/null || echo '. /root/.cri_env' >> /root/.bashrc`,
      ].join("\n") + "\n\n";

      // Optional username/password auth: the frontend "allowed list"
      // (MosquittoFunctions) provides {username,password} pairs. When present we
      // build a hashed password_file with mosquitto_passwd and require auth on the
      // network listeners (1883/9001). A localhost-only listener (1884) is always
      // kept anonymous so the local admin "Value Stream" keeps working.
      const shq = (v) => String(v == null ? "" : v).replace(/'/g, "'\\''");
      const users = Array.isArray(machine.mqtt?.users)
        ? machine.mqtt.users.filter((u) => u && u.username)
        : [];
      let authSetup = "";
      let listenerAuth = "allow_anonymous true";
      // `user root` so the broker (which otherwise drops to the mosquitto user)
      // can read the root-owned, 0600 password_file we generate in the container.
      let userDirective = "";
      if (users.length > 0) {
        const pwLines = users
          .map((u, i) => `mosquitto_passwd ${i === 0 ? "-c " : ""}-b /mosquitto/config/passwd '${shq(u.username)}' '${shq(u.password || "")}'`)
          .join("\n");
        authSetup = `rm -f /mosquitto/config/passwd\n${pwLines}\nchmod 600 /mosquitto/config/passwd\n`;
        listenerAuth = "allow_anonymous false\npassword_file /mosquitto/config/passwd";
        userDirective = "user root\n";
      }

      const mosquittoScript = `#!/bin/sh\n\n` + criBlock +
`echo "nameserver 8.8.8.8" > /etc/resolv.conf
CRI_INTERFACES_LEN=$(echo $CRI_INTERFACES | jq "length")
i=0
while [ "\$i" -lt "\$CRI_INTERFACES_LEN" ]; do
    CRIINTERFACE_NAME=$(echo $CRI_INTERFACES | jq -r ".[\$i].name")
    CRIINTERFACE_ADDRESS=$(echo $CRI_INTERFACES | jq -r ".[\$i].address")

    ip addr add \${CRIINTERFACE_ADDRESS} dev \${CRIINTERFACE_NAME}
    ip link set \${CRIINTERFACE_NAME} up
    echo "interface \${CRIINTERFACE_NAME} set with \${CRIINTERFACE_ADDRESS}"

    i=\$((i + 1))
done

mkdir -p /mosquitto/config /mosquitto/data /mosquitto/log /mosquitto/certs
openssl req -x509 -newkey rsa:2048 -keyout /mosquitto/certs/server.key -out /mosquitto/certs/server.crt -days 3650 -nodes -subj "/CN=${machineName}-mosquitto" 2>/dev/null
chmod 644 /mosquitto/certs/server.crt
chmod 600 /mosquitto/certs/server.key
${authSetup}cat > /mosquitto/config/mosquitto.conf << '__MOSQ_EOF__'
${userDirective}per_listener_settings true

listener 1883
${listenerAuth}

listener 9001
protocol websockets
${listenerAuth}

listener 8883
certfile /mosquitto/certs/server.crt
keyfile /mosquitto/certs/server.key
${listenerAuth}

listener 1884 127.0.0.1
allow_anonymous true
__MOSQ_EOF__

mosquitto -c /mosquitto/config/mosquitto.conf &

smoloki -b http://10.1.0.254:3100 '{"job":"test","level":"info","host":"'"$(hostname)"'"}' '{"message":"ready"}'
`;

      lab.file[`${machineName}.startup`] = mosquittoScript;
      continue;
    }

    if (machine.type === "mqtt_pub") {
      const criJson = buildCriInterfaces(machine);
      const safeJson = criJson.replace(/'/g, "'\\''");
      const criBlock = [
        `export CRI_INTERFACES='${safeJson}'`,
        `cat > /root/.cri_env << '__CRI_ENV_EOF__'`,
        `export CRI_INTERFACES='${safeJson}'`,
        `__CRI_ENV_EOF__`,
        `grep -qxF '. /root/.cri_env' /root/.bashrc 2>/dev/null || echo '. /root/.cri_env' >> /root/.bashrc`,
      ].join("\n") + "\n\n";

      // Publisher parameters come from the frontend (MqttPubFunctions). Embed them
      // as single-quoted shell literals (' escaped) so spaces/special chars in the
      // message are safe. Defaults mirror the values requested in the UI.
      const cfg = machine.mqtt || {};
      const sh = (v, dflt) => String(v === undefined || v === null || v === "" ? dflt : v).replace(/'/g, "'\\''");
      const brokerAddr = sh(cfg.broker_addr, "10.0.0.1");
      const brokerPort = sh(cfg.broker_port, "1883");
      const topic = sh(cfg.topic, "test/topic");
      const message = sh(cfg.message, '{"value": 100}');
      const time = sh(cfg.time, "1");
      const username = sh(cfg.username, "");
      const password = sh(cfg.password, "");

      const mqttScript = `#!/bin/sh\n\n` + criBlock +
`echo "nameserver 8.8.8.8" > /etc/resolv.conf
CRI_INTERFACES_LEN=$(echo $CRI_INTERFACES | jq "length")
i=0
while [ "\$i" -lt "\$CRI_INTERFACES_LEN" ]; do
    CRIINTERFACE_NAME=$(echo $CRI_INTERFACES | jq -r ".[\$i].name")
    CRIINTERFACE_ADDRESS=$(echo $CRI_INTERFACES | jq -r ".[\$i].address")

    ip addr add \${CRIINTERFACE_ADDRESS} dev \${CRIINTERFACE_NAME}
    ip link set \${CRIINTERFACE_NAME} up
    echo "interface \${CRIINTERFACE_NAME} set with \${CRIINTERFACE_ADDRESS}"

    i=\$((i + 1))
done

# Signal readiness before the (blocking) publish loop, otherwise the deploy
# modal would wait forever.
smoloki -b http://10.1.0.254:3100 '{"job":"test","level":"info","host":"'"$(hostname)"'"}' '{"message":"ready"}'

BROKER_ADDR='${brokerAddr}'
BROKER_PORT='${brokerPort}'
TOPIC='${topic}'
MESSAGE='${message}'
TIME='${time}'
USERNAME='${username}'
PASSWORD='${password}'
AUTH_ARGS=\${USERNAME:+-u "\$USERNAME" -P "\$PASSWORD"}

# Install wait4x (via Homebrew) if missing so we can wait for the broker/proxy.
if ! command -v wait4x >/dev/null 2>&1; then
    if [ "$(id -u)" -ne 0 ]; then
        if ! command -v brew >/dev/null 2>&1; then
            apt-get update
            apt-get install -y curl git
            yes "" | /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            tee -a ~/.bashrc > /dev/null << '__HOMEBREW_EOF__'
if [ -x /home/linuxbrew/.linuxbrew/bin/brew ]; then
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi
__HOMEBREW_EOF__
            . ~/.bashrc 2>/dev/null || true
        fi
        brew install -y wait4x 2>/dev/null || true
    fi
fi
# Homebrew refuses to run as root (kathara containers do), so fall back to the
# official static binary when wait4x is still missing.
if ! command -v wait4x >/dev/null 2>&1; then
    curl -fsSL -o /tmp/wait4x.tgz https://github.com/wait4x/wait4x/releases/download/v3.7.1/wait4x-linux-amd64.tar.gz
    tar -xzf /tmp/wait4x.tgz -C /usr/local/bin wait4x
    chmod +x /usr/local/bin/wait4x
fi

# Wait until the broker (or its TLS proxy) is accepting connections.
wait4x tcp "\${BROKER_ADDR}:\${BROKER_PORT}" --timeout 90s

# TLS fallback: if the broker/proxy accepts a TLS connection, publish securely;
# otherwise fall back to plaintext MQTT.
TLS_ARGS=""
if timeout 5 mosquitto_pub --cafile /rootCA.pem --insecure \
    -h "\$BROKER_ADDR" -p "\$BROKER_PORT" \$AUTH_ARGS -t "\$TOPIC" -m "\$MESSAGE" > /dev/null 2>&1; then
    TLS_ARGS="--cafile /rootCA.pem --insecure"
    echo "[mqtt_pub] broker accepts TLS, publishing securely"
else
    echo "[mqtt_pub] broker does not accept TLS, falling back to plaintext"
fi

while true; do
    mosquitto_pub \$TLS_ARGS -h "\$BROKER_ADDR" -p "\$BROKER_PORT" \$AUTH_ARGS -t "\$TOPIC" -m "\$MESSAGE"
    sleep "\$TIME"
done
`;

      lab.file[`${machineName}.startup`] = mqttScript;
      continue;
    }

    if (machine.type === "netproxy") {
      const criJson = buildCriInterfaces(machine);
      const safeJson = criJson.replace(/'/g, "'\\''");
      const criBlock = [
        `export CRI_INTERFACES='${safeJson}'`,
        `cat > /root/.cri_env << '__CRI_ENV_EOF__'`,
        `export CRI_INTERFACES='${safeJson}'`,
        `__CRI_ENV_EOF__`,
        `grep -qxF '. /root/.cri_env' /root/.bashrc 2>/dev/null || echo '. /root/.cri_env' >> /root/.bashrc`,
      ].join("\n") + "\n\n";

      const netproxyScript = `#!/bin/sh\n\n` + criBlock +
`echo "nameserver 8.8.8.8" > /etc/resolv.conf
CRI_INTERFACES_LEN=$(echo $CRI_INTERFACES | jq "length")
i=0
while [ "\$i" -lt "\$CRI_INTERFACES_LEN" ]; do
    CRIINTERFACE_NAME=$(echo $CRI_INTERFACES | jq -r ".[\$i].name")
    CRIINTERFACE_ADDRESS=$(echo $CRI_INTERFACES | jq -r ".[\$i].address")

    ip addr add \${CRIINTERFACE_ADDRESS} dev \${CRIINTERFACE_NAME}
    ip link set \${CRIINTERFACE_NAME} up
    echo "interface \${CRIINTERFACE_NAME} set with \${CRIINTERFACE_ADDRESS}"

    i=\$((i + 1))
done
if [ -f "/shared/\${HOSTNAME}.json" ]; then cp /shared/\${HOSTNAME}.json /config.json; fi
netproxy & disown

smoloki -b http://10.1.0.254:3100 '{"job":"test","level":"info","host":"'"$(hostname)"'"}' '{"message":"ready"}'
`;

      lab.file[`${machineName}.startup`] = netproxyScript;
      continue;
    }

    if (machine.type === "device") {
      const criJson = buildCriInterfaces(machine);
      const safeJson = criJson.replace(/'/g, "'\\''");
      const criBlock = [
        `export CRI_INTERFACES='${safeJson}'`,
        `cat > /root/.cri_env << '__CRI_ENV_EOF__'`,
        `export CRI_INTERFACES='${safeJson}'`,
        `__CRI_ENV_EOF__`,
        `grep -qxF '. /root/.cri_env' /root/.bashrc 2>/dev/null || echo '. /root/.cri_env' >> /root/.bashrc`,
      ].join("\n") + "\n\n";

      const deviceScript = `#!/bin/sh\n\n` + criBlock +
`echo "nameserver 8.8.8.8" > /etc/resolv.conf
CRI_INTERFACES_LEN=$(echo $CRI_INTERFACES | jq "length")
i=0
while [ "\$i" -lt "\$CRI_INTERFACES_LEN" ]; do
    CRIINTERFACE_NAME=$(echo $CRI_INTERFACES | jq -r ".[\$i].name")
    CRIINTERFACE_ADDRESS=$(echo $CRI_INTERFACES | jq -r ".[\$i].address")

    ip addr add \${CRIINTERFACE_ADDRESS} dev \${CRIINTERFACE_NAME}
    ip link set \${CRIINTERFACE_NAME} up
    echo "interface \${CRIINTERFACE_NAME} set with \${CRIINTERFACE_ADDRESS}"

    i=\$((i + 1))
done
mkdir -p /scenario
if [ -d "/shared/\${HOSTNAME}" ]; then cp /shared/\${HOSTNAME}/*.json /scenario/ 2>/dev/null || true; fi
/start.sh > /var/log/device.log 2>&1 & disown

smoloki -b http://10.1.0.254:3100 '{"job":"test","level":"info","host":"'"$(hostname)"'"}' '{"message":"ready"}'
`;

      lab.file[`${machineName}.startup`] = deviceScript;
      continue;
    }

    if (machine.type === "tls_termination_proxy") {
      const { in_addr = "0.0.0.0:50000", out_addr = "10.1.0.2:50001", verify = "0" } = machine.tls || {};
      const tlsScript = `
cd /etc/stunnel
mkcert -cert-file server.crt -key-file server.key "localhost" "127.0.0.1" $(hostname -I)

tee /etc/stunnel/stunnel.conf << __EOF__
cert = /etc/stunnel/server.crt
key  = /etc/stunnel/server.key
CAfile = $(mkcert -CAROOT)/rootCA.pem

verify = ${verify}
sslVersion = TLSv1.2
options = NO_SSLv2
options = NO_SSLv3
options = NO_COMPRESSION
pid = /var/run/stunnel.pid
foreground = no

[section]
accept = ${in_addr}
connect = ${out_addr}
__EOF__

smoloki -b http://10.1.0.254:3100 '{"job":"test","level":"info","host":"'"$(hostname)"'"}' '{"message":"ready"}' 2>/dev/null || true

stunnel
`;
      lab.file[`${machineName}.startup`] = header + ipSetup + tlsScript;
    } else {
      let extraCommands = "";
      if (machine.type === "engine") {
        const opMode = machine.industrial?.operationalMode || "engine";

        if (opMode === "engine") {
          // Default values matching engine.py defaults
          let args = "";
          // If properties existed in machine model, we would map them here:
          // if (machine.engine?.temperatureStep) args += ` -t ${machine.engine.temperatureStep}`;

          extraCommands += `uv run /engine.py${args} > /var/log/engine.log 2>&1 & disown\n`;
        }
      }

      if (machine.type === "plc") {
        // Add monitored machines
        if (machine.industrial?.monitored_machines && Array.isArray(machine.industrial.monitored_machines)) {
          for (const monitoredId of machine.industrial.monitored_machines) {
            const targetMachine = netkit.find(m => m.id === monitoredId);
            if (targetMachine) {
              // Config holders are not deployed: skip them so they don't shift
              // the OpenPLC Modbus device order (and the %IW/%QW addresses).
              if (isHolderDevice(targetMachine)) continue;
              // Determine IP address: use Industrial Network (eth1)
              let targetIp = null;
              const eth1Interface = targetMachine.interfaces?.if?.find((i) => i.eth?.number === 1);
              if (eth1Interface && eth1Interface.ip) {
                targetIp = eth1Interface.ip.split("/")[0];
              }

              if (targetIp) {
                if (targetMachine.type === "device") {
                  // A device machine exposes one Modbus server per peripheral,
                  // each on its own port. openplc-cli hardcodes the scan ranges
                  // to 0..8, so after adding the device we point them at the
                  // registers actually served (mbconfig.cfg is what the runtime
                  // reads at startup; the DB keeps the web UI consistent).
                  if (!extraCommands.includes("plc_device_set_ranges()")) {
                    extraCommands += `plc_device_set_ranges() {
  _NAME="$1"; _IR_START="$2"; _IR_SIZE="$3"; _HR_START="$4"; _HR_SIZE="$5"
  _CFG=/opt/OpenPLC_v3/webserver/mbconfig.cfg
  _DEV_ID=$(grep -oP "^device\\K[0-9]+(?=\\.name = \\"\${_NAME}\\")" "\$_CFG" || true)
  if [ -n "\$_DEV_ID" ]; then
    sed -i \\
      -e "s|^device\${_DEV_ID}\\.Discrete_Inputs_Size = .*|device\${_DEV_ID}.Discrete_Inputs_Size = \\"0\\"|" \\
      -e "s|^device\${_DEV_ID}\\.Coils_Size = .*|device\${_DEV_ID}.Coils_Size = \\"0\\"|" \\
      -e "s|^device\${_DEV_ID}\\.Input_Registers_Start = .*|device\${_DEV_ID}.Input_Registers_Start = \\"\${_IR_START}\\"|" \\
      -e "s|^device\${_DEV_ID}\\.Input_Registers_Size = .*|device\${_DEV_ID}.Input_Registers_Size = \\"\${_IR_SIZE}\\"|" \\
      -e "s|^device\${_DEV_ID}\\.Holding_Registers_Read_Start = .*|device\${_DEV_ID}.Holding_Registers_Read_Start = \\"\${_HR_START}\\"|" \\
      -e "s|^device\${_DEV_ID}\\.Holding_Registers_Read_Size = .*|device\${_DEV_ID}.Holding_Registers_Read_Size = \\"\${_HR_SIZE}\\"|" \\
      -e "s|^device\${_DEV_ID}\\.Holding_Registers_Start = .*|device\${_DEV_ID}.Holding_Registers_Start = \\"\${_HR_START}\\"|" \\
      -e "s|^device\${_DEV_ID}\\.Holding_Registers_Size = .*|device\${_DEV_ID}.Holding_Registers_Size = \\"\${_HR_SIZE}\\"|" \\
      "\$_CFG"
  fi
  sqlite3 /opt/OpenPLC_v3/webserver/openplc.db "UPDATE Slave_dev SET di_size=0, coil_size=0, ir_start=\${_IR_START}, ir_size=\${_IR_SIZE}, hr_read_start=\${_HR_START}, hr_read_size=\${_HR_SIZE}, hr_write_start=\${_HR_START}, hr_write_size=\${_HR_SIZE} WHERE dev_name='\${_NAME}';" || true
}
`;
                  }
                  const wordLen = (t) => (String(t).includes("32") ? 2 : 1);
                  const range = (vars) => {
                    if (vars.length === 0) return [0, 0];
                    const start = Math.min(...vars.map((v) => v.register));
                    const end = Math.max(...vars.map((v) => v.register + wordLen(v.type)));
                    return [start, end - start];
                  };
                  for (const ep of getDeviceModbusEndpoints(targetMachine)) {
                    const devName = `${targetMachine.name}_${ep.name}`;
                    const [irStart, irSize] = range(ep.variables.filter((v) => v.kind === "input"));
                    const [hrStart, hrSize] = range(ep.variables.filter((v) => v.kind === "holding"));
                    extraCommands += `openplc-cli device add "${devName}" "${targetIp}" "${ep.port}"\n`;
                    extraCommands += `plc_device_set_ranges "${devName}" ${irStart} ${irSize} ${hrStart} ${hrSize}\n`;
                  }
                } else if (targetMachine.type === "netproxy") {
                  // A netproxy exposes one Modbus listener per proxy rule, on
                  // its own in_ip:in_port. Point OpenPLC at each listener so the
                  // traffic flows through the proxy (and its interceptors).
                  const proxyRules = Array.isArray(targetMachine.netproxy?.rules) ? targetMachine.netproxy.rules : [];
                  for (const rule of proxyRules) {
                    if (!rule?.in_ip || !rule?.in_port) continue;
                    const devName = proxyRules.length > 1
                      ? `${targetMachine.name}_${rule.name || "proxy"}`
                      : (targetMachine.name || "netproxy");
                    extraCommands += `openplc-cli device add "${devName}" "${rule.in_ip}" "${rule.in_port}"\n`;
                  }
                } else {
                  extraCommands += `openplc-cli device add "${targetMachine.name}" "${targetIp}" "502"\n`;
                }
              }
            }
          }
        }

        if (machine.industrial?.plcProgramName) {
          const extension = machine.industrial.plcProgramName.includes('.') ? machine.industrial.plcProgramName.split('.').pop() : 'st';
          extraCommands += `openplc-cli program add "/shared/\${HOSTNAME}.${extension}" "main" "main program"\n`;
        }

        console.log(`[DEBUG] Checking password for machine ${machine.name}:`, machine.industrial?.password);
        if (machine.industrial?.password) {
          extraCommands += `openplc-cli changeuser -u openplc -p "${machine.industrial.password}"\n`;
        }

        extraCommands += `smoloki -b "http://10.1.0.254:3100" '{"job":"job","level":"info","host":"'"\$HOSTNAME"'"}' '{"message":"ready"}'\n`;
        extraCommands += `/opt/OpenPLC_v3/start_openplc.sh & disown \n`;
      }

      if (machine.type === "scada") {
        let monitoredMachines = [];
        if (machine.industrial?.monitored_machines && Array.isArray(machine.industrial.monitored_machines)) {
          for (const monitoredId of machine.industrial.monitored_machines) {
            const targetMachine = netkit.find(m => m.id === monitoredId);
            if (targetMachine) {
              // Config holders are not deployed: skip them so the SCADA
              // auto-discovery only sees real Modbus servers.
              if (isHolderDevice(targetMachine)) continue;
              let targetIp = null;
              const eth1Interface = targetMachine.interfaces?.if?.find((i) => i.eth?.number === 1);
              if (eth1Interface && eth1Interface.ip) {
                targetIp = eth1Interface.ip.split("/")[0];
              }
              if (!targetIp && targetMachine.computedEth0Ip) {
                targetIp = targetMachine.computedEth0Ip.split("/")[0];
              } else if (!targetIp && targetMachine.interfaces?.if?.[0]?.ip) {
                targetIp = targetMachine.interfaces.if[0].ip.split("/")[0];
              }

              if (targetMachine.type === "device") {
                // One FUXA device per Modbus peripheral, with its variables as tags
                const fuxaType = (t) => ({
                  uint16: "UInt16", int16: "Int16",
                  uint32: "UInt32", int32: "Int32",
                  float32: "Float", bool: "Bool",
                }[String(t).toLowerCase()] || "UInt16");

                for (const ep of getDeviceModbusEndpoints(targetMachine)) {
                  monitoredMachines.push({
                    name: `${targetMachine.name || "device"}_${ep.name}`,
                    type: "device",
                    address: targetIp,
                    port: ep.port,
                    tags: ep.variables.map((v) => ({
                      name: v.name,
                      // FUXA tag addresses are 1-based: its modbus driver does
                      // "address - 1" on the wire, while the peripheral serves
                      // the 0-based address written in the config
                      address: v.register + 1,
                      type: fuxaType(v.type),
                      registry: v.kind === "holding" ? "holding_register" : "input_register",
                    })),
                  });
                }
              } else if (targetMachine.type === "netproxy") {
                // One monitored endpoint per proxy rule, at its in_ip:in_port,
                // so SCADA polls through the proxy instead of the backend.
                const proxyRules = Array.isArray(targetMachine.netproxy?.rules) ? targetMachine.netproxy.rules : [];
                for (const rule of proxyRules) {
                  if (!rule?.in_ip || !rule?.in_port) continue;
                  monitoredMachines.push({
                    name: proxyRules.length > 1
                      ? `${targetMachine.name || "netproxy"}_${rule.name || "proxy"}`
                      : (targetMachine.name || "netproxy"),
                    type: "netproxy",
                    address: rule.in_ip,
                    port: rule.in_port,
                  });
                }
              } else {
                monitoredMachines.push({
                  name: targetMachine.name || targetMachine.type,
                  type: targetMachine.type,
                  address: targetIp
                });
              }
            }
          }
        }

        const safeJson = JSON.stringify(monitoredMachines).replace(/'/g, "'\\''");
        extraCommands += `\nexport MONITORED_MACHINES='${safeJson}'\n`;
        extraCommands += `cat << 'MONITORED_EOF' >> /root/.bashrc\nexport MONITORED_MACHINES='${safeJson}'\nMONITORED_EOF\n` + `
# SCADA Server Wrapper
COMMAND=(npm run start)
PATTERN='WebServer is running http://127.0.0.1:1881/'

FIFO=$(mktemp -u)
mkfifo "$FIFO"
"\${COMMAND[@]}" >"$FIFO" 2>&1 &
WRAPPER_PID=$!
while IFS= read -r line; do
  echo "$line"
  if [[ "$line" == *"$PATTERN"* ]]; then
    LISTENER_PID="$(ss -lptn 'sport = :1881' | sed -n 's/.*pid=\\([0-9]\\+\\).*/\\1/p' | head -n1)"
    echo "Closing listener on :1881 (PID=$LISTENER_PID), wrapper PID=$WRAPPER_PID"
    [ -n "$LISTENER_PID" ] && kill -TERM "$LISTENER_PID" 2>/dev/null || true
    kill -TERM "$WRAPPER_PID" 2>/dev/null || true
    break
  fi
done <"$FIFO"
rm -f "$FIFO"

if [ -f "/shared/\${HOSTNAME}.db" ]; then
  rm -f /usr/src/app/FUXA/server/_appdata/project.fuxap.db
  cp /shared/\${HOSTNAME}.db /usr/src/app/FUXA/server/_appdata/project.fuxap.db
fi



npm start & disown

# add machines

HOST="http://localhost:1881"
INTERVAL=2
while true; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "\$HOST" || echo "000")
    if [[ "\$STATUS" == "200" ]]; then
        echo "online"
        break
    fi
    echo "Host unreachable (HTTP \$STATUS). try again in \$INTERVAL"
    sleep "\$INTERVAL"
done

MONITORED_MACHINES_LEN=$(echo $MONITORED_MACHINES | jq 'length')
for (( i=0; i<\${MONITORED_MACHINES_LEN}; i++ )); do
    MACHINE_NAME=$(echo \$MONITORED_MACHINES | jq -r .[$i].name)
    MACHINE_TYPE=$(echo \$MONITORED_MACHINES | jq -r .[$i].type)
    MACHINE_ADDRESS=$(echo \$MONITORED_MACHINES | jq -r .[$i].address)
    MACHINE_PORT=$(echo \$MONITORED_MACHINES | jq -r '.['$i'].port // 502')
    fuxa_device_add localhost:1881 "\${MACHINE_NAME}" "\${MACHINE_ADDRESS}:\${MACHINE_PORT}" 250

    #insert tag
    case "\$MACHINE_TYPE" in
    "temperature_sensor")
		fuxa_tag_add localhost:1881 \${MACHINE_NAME} temperature 1 Int16 input_register temperature
        ;;
    "fan")
	    fuxa_tag_add localhost:1881 \${MACHINE_NAME} status 1 Bool coil_status status
        ;;
    "device")
        TAGS_LEN=$(echo \$MONITORED_MACHINES | jq -r '.['$i'].tags | length')
        for (( j=0; j<\${TAGS_LEN}; j++ )); do
            TAG_NAME=$(echo \$MONITORED_MACHINES | jq -r '.['$i'].tags['$j'].name')
            TAG_ADDRESS=$(echo \$MONITORED_MACHINES | jq -r '.['$i'].tags['$j'].address')
            TAG_TYPE=$(echo \$MONITORED_MACHINES | jq -r '.['$i'].tags['$j'].type')
            TAG_REGISTRY=$(echo \$MONITORED_MACHINES | jq -r '.['$i'].tags['$j'].registry')
            fuxa_tag_add localhost:1881 \${MACHINE_NAME} \${TAG_NAME} \${TAG_ADDRESS} \${TAG_TYPE} \${TAG_REGISTRY} \${TAG_NAME}
        done
        ;;
	esac

done


smoloki -b "http://10.1.0.254:3100" '{"job":"job","level":"info","host":"'"$HOSTNAME"'"}' '{"message":"ready"}'
`;
      }


      if (machine.type === "temperature_sensor") {
        extraCommands += `
        smoloki -b "http://10.1.0.254:3100" '{"job":"job","level":"info","host":"'"$HOSTNAME"'"}' '{"message":"ready"}'
        `
      }


      if (machine.type === "terminal") {
        extraCommands += `
        smoloki -b "http://10.1.0.254:3100" '{"job":"job","level":"info","host":"'"$HOSTNAME"'"}' '{"message":"ready"}'
        `
      }

      if (machine.type === "attacker") {
        extraCommands += `
        smoloki -b "http://10.1.0.254:3100" '{"job":"job","level":"info","host":"'"$HOSTNAME"'"}' '{"message":"ready"}'
        `
      }



      // NGFW startup append
      if (machine.type === "ngfw") {
        const wafRulesJson = JSON.stringify(machine.ngfw?.wafRules || []);
        const safeJson = wafRulesJson.replace(/'/g, "'\\''");
        extraCommands += `
            set +euo pipefail
            export WAF_RULES='${safeJson}'\n
tee -a  /root/.bashrc<<__EOF__ 
  export WAF_RULES='${safeJson}'
__EOF__

# Apply all the waf rules
WAF_RULES_LEN=$(echo $WAF_RULES | jq -r 'length')

for ((i = 0; i <= \${WAF_RULES_LEN} - 1; i += 1)); do
    INTERFACE="$(echo \${WAF_RULES} | jq -r .[$i].interface)"
    INPUT_PORT="$(echo \${WAF_RULES} | jq -r .[$i].input_port)"
    OUTPUT_ENDPOINT="$(echo \${WAF_RULES} | jq -r .[$i].output_endpoint)"
    PAGE="$(echo \${WAF_RULES} | jq -r .[$i].page)"
    HTTP_CODE="$(echo \${WAF_RULES} | jq -r .[$i].http_code)"
    METHOD="$(echo \${WAF_RULES} | jq -r .[$i].method)"
    PROTOCOL="$(echo \${WAF_RULES} | jq -r .[$i].protocol)"
    FINDTIME="$(echo \${WAF_RULES} | jq -r .[$i].findtime)"
    MAXRETRY="$(echo \${WAF_RULES} | jq -r .[$i].maxretry)"
    BANTIME="$(echo \${WAF_RULES} | jq -r .[$i].bantime)"
    wafadd \${INTERFACE} \${INPUT_PORT} \${OUTPUT_ENDPOINT} \${PAGE} \${HTTP_CODE} \${METHOD} \${PROTOCOL} \${FINDTIME} \${MAXRETRY} \${BANTIME}
done




            if [ -n "$WAF_RULES" ] && [ "$WAF_RULES" != "[]" ]; then
                export PATH="$PATH:/root/.asdf/shims"
            fi


            if [[ "$REGISTRY_ADDR_PROTECT_BTN" == "yes" ]]; then
              export PATH="$PATH:/root/.asdf/shims"
              
              INPUT_ADDRESS=$(ip -o addr show dev eth1 | awk '{split($4,a,"/"); print a[1]}')
              snortadd \${INPUT_ADDRESS}:502 \${REGISTRY_ADDR_PROTECT_ADDR}:502 eth1 modbus-invalidreg 'alert tcp any 502 -> any any (msg: "Traffic detected"; sid:1000001; rev:1;)' 10m 5 1h

              yq -i '(.outputs[] | select(has("eve-log")).eve-log.types) |= (. + "modbus" | unique)' /etc/suricata/suricata.yaml
              yq -i '.app-layer.protocols.modbus.enabled = "yes"' /etc/suricata/suricata.yaml

              crudini --set /etc/fail2ban/jail.d/suricata-1000001.local "suricata-1000001" logpath "/tmp/f2b.log"
              # wait for kernel module to be loaded
              sleep 3
              service suricata start
              sleep 1
              service f2bcompanion start
              sleep 1
              service fail2ban restart
              sleep 1
              service suricata stop
              sleep 1
              service suricata start
            fi

            smoloki -b "http://10.1.0.254:3100" '{"job":"job","level":"info","host":"'"$HOSTNAME"'"}' '{"message":"ready"}'
          `;
      }
      // For plain terminals/attackers the "ready" signal (in extraCommands) is the
      // only workload; put it right after the network setup, BEFORE the user's
      // startup body. Otherwise a body that blocks in the foreground (a scan loop,
      // a listener) or exits non-zero under `set -euo pipefail` would abort the
      // script before "ready" is ever sent, stalling the deploy modal forever.
      // "ready" here just means "container up + network configured".
      if (machine.type === "terminal" || machine.type === "attacker") {
        lab.file[`${machineName}.startup`] = header + ipSetup + extraCommands + (body ? "\n" + body + "\n" : "");
      } else {
        lab.file[`${machineName}.startup`] = header + ipSetup + (body ? body + "\n\n" : "") + extraCommands;
      }
    }

  }
}

/* -------------------- LAB CONF -------------------- */

function makeLabInfo(info, lab) {
  if (info) {
    lab.file["lab.conf"] = "";
    if (info.description && info.description !== "")
      lab.file["lab.conf"] += `LAB_DESCRIPTION="${info.description}"\n`;
    if (info.version && info.version !== "")
      lab.file["lab.conf"] += `LAB_VERSION="${info.version}"\n`;
    if (info.author && info.author !== "")
      lab.file["lab.conf"] += `LAB_AUTHOR="${info.author}"\n`;
    if (info.email && info.email !== "")
      lab.file["lab.conf"] += `LAB_EMAIL="${info.email}"\n`;
    if (info.web && info.web !== "")
      lab.file["lab.conf"] += `LAB_WEB="${info.web}"\n`;
    if (lab.file["lab.conf"] !== "") lab.file["lab.conf"] += "\n";
  }
}

function makeLabConfFile(netkit, lab) {
  if (!lab.file["lab.conf"]) lab.file["lab.conf"] = "";

  //lab.file["lab.conf"] += "collector[bridged]=true\n";
  //lab.file["lab.conf"] += 'collector[port]="1337:80"\n';

  //QUESTA NON NA RIMESSA
  // collector[0]=_collector → vedi bug #230, quindi non lo aggiungiamo

  //lab.file["lab.conf"] += "collector[image]=icr/collector\n";
  //lab.file["lab.conf"] += "collectordb[0]=_collector\n";
  //lab.file["lab.conf"] += "collectordb[image]=icr/collector-db\n";

  //PER UNIX POST MAC

  lab.file["lab.conf"] += "collector[bridged]=true\n";
  lab.file["lab.conf"] += 'collector[port]="3100:3100/tcp"\n';
  lab.file["lab.conf"] += 'collector[0]="_collector"\n';
  lab.file["lab.conf"] += "collector[image]=\"icr/collector\"\n";
  lab.file["collector.startup"] += '#!/bin/sh\n'
  lab.file["collector.startup"] += 'echo "nameserver 8.8.8.8" > /etc/resolv.conf\n'
  lab.file["collector.startup"] += 'loki -config.file=/etc/loki/config.yml &\n'
  lab.file["collector.startup"] += 'ip addr add 10.1.0.254/24 dev eth0\n'
  lab.file["collector.startup"] += 'ip link set eth0 up\n'

  // PER BUG MAC

  //lab.file["lab.conf"] += "collector[bridged]=true\n";
  //  lab.file["lab.conf"] += 'collector[port]="3100:3100/tcp"\n';
  //  lab.file["lab.conf"] += "collector[image]=\"icr/collector\"\n";
  //kathara lconfig -n collector --add "_collector"
  //tramite docker exec nel main, lanciare
  //ip addr add 10.1.0.254/24 dev eth1
  //ip link set eth1 up



  //flag sistema operativo mac/Windows workaround linux no 
  //solo prime due righe e quarta
  //quando partito, fare NEL MAIN lconfig .... e poi eseguire all'interno i due comandi ip addr ed ip link

  const physSimIp = getPhysSimIp(netkit.find((m) => isPhysicalSim(m)) || {});

  for (let machine of netkit) {
    // Config holders are not deployed: they only hold the uploaded scenario.
    if (machine.type === "device" && isHolderDevice(machine)) continue;
    // Nome “forzato” e sanificato per evitare slash ecc.
    const rawName =
      machine.type === "attacker" ? (machine.name || "attacker") :
        machine.name || "node";
    const machineName = String(rawName).replace(/[^\w.-]/g, "_");

    for (let machineInterface of machine.interfaces.if) {
      if (machineInterface.eth.number > 0 && machineInterface.eth.domain && machineInterface.eth.domain !== "") {
        lab.file["lab.conf"] += `${machineName}[${machineInterface.eth.number}]=${machineInterface.eth.domain}\n`;
      }
    }
    // aggiunge l'interfaccia _collector come ultima
    const lastIndex = machine.interfaces.if[machine.interfaces.if.length - 1]?.eth?.number ?? -1;
    //lab.file["lab.conf"] += `${machine.name}[${lastIndex + 1}]=_collector\n`;
    lab.file["lab.conf"] += `${machineName}[0]=_collector\n`;
    lab.file["lab.conf"] += `${machineName}[bridged]=true\n`;
    // Custom machines free up the volume slot for user-defined mounts
    const hasUserVolumes = (machine.type === "other" && (machine.other?.volumes?.length > 0)) ||
      (machine.type === "attacker" && machine.customAttackId && (machine.attacker?.volumes?.length > 0));
    if (!hasUserVolumes) {
      lab.file["lab.conf"] += `${machineName}[volume]="/lib/modules|/lib/modules|ro"\n`;
    }

    // image per tipo
    if (machine.type == "engine") { lab.file["lab.conf"] += machine.name + "[image]=icr/engine"; }
    if (machine.type == "fan") { lab.file["lab.conf"] += machine.name + "[image]=icr/fan"; }
    if (machine.type == "temperature_sensor") { lab.file["lab.conf"] += machine.name + "[image]=icr/temperature_sensor"; }
    if (machine.type == "tls_termination_proxy") { lab.file["lab.conf"] += machine.name + "[image]=icr/tls_termination_proxy"; }
    if (machine.type == "rejector") { lab.file["lab.conf"] += machine.name + "[image]=icr/rejector"; }
    if (machine.type == "scada") { lab.file["lab.conf"] += machine.name + "[image]=icr/scada"; }
    if (machine.type == "apg") { lab.file["lab.conf"] += machine.name + "[image]=icr/apg"; }
    if (machine.type == "laser") { lab.file["lab.conf"] += machine.name + "[image]=icr/laser"; }
    if (machine.type == "conveyor") { lab.file["lab.conf"] += machine.name + "[image]=icr/conveyor"; }
    if (machine.type == "plc") { lab.file["lab.conf"] += machine.name + "[image]=icr/plc"; }
    if (machine.type == "netproxy") { lab.file["lab.conf"] += `${machineName}[image]=icr/netproxy\n`; }
    if (machine.type == "device") {
      lab.file["lab.conf"] += `${machineName}[image]=icr/device\n`;
      if (isPhysicalSim(machine)) {
        // physics-sim web UI (only the physical simulator maps the host port)
        lab.file["lab.conf"] += `${machineName}[env]="DEVICE_MODE=physical-sim"\n`;
        lab.file["lab.conf"] += `${machineName}[port]="8080:8080/tcp"\n`;
      } else if (isPeripheral(machine)) {
        // Peripherals connect to the physics simulator over netstream.
        lab.file["lab.conf"] += `${machineName}[env]="DEVICE_MODE=peripheral"\n`;
        lab.file["lab.conf"] += `${machineName}[env]="NETSTREAM_ADDR=${physSimIp}:${NETSTREAM_PORT}"\n`;
      }
    }
    if (machine.type == "mosquitto") {
      lab.file["lab.conf"] += `${machineName}[image]=icr/mosquitto\n`;
      lab.file["lab.conf"] += `${machineName}[port]="1883:1883/tcp"\n`;
      lab.file["lab.conf"] += `${machineName}[port]="9001:9001/tcp"\n`;
    }
    if (machine.type == "mqtt_pub") {
      lab.file["lab.conf"] += `${machineName}[image]=icr/mqtt_pub\n`;
    }
    if (machine.type == "router") {
      if (machine.routingSoftware == "frr") {
        //lab.file["lab.conf"] += `${machine.name}[image]=kathara/frr`;
        lab.file["lab.conf"] += `${machineName}[image]=kathara/frr`;
      }
      if (machine.routingSoftware == "quagga") {
        //lab.file["lab.conf"] += `${machine.name}[image]=kathara/quagga`;
        lab.file["lab.conf"] += `${machineName}[image]=kathara/quagga`;
      }
    }
    if (machine.type == "terminal" || machine.type == "ws" || machine.type == "ns") {
      //lab.file["lab.conf"] += `${machine.name}[image]=icr/kathara-base`;
      lab.file["lab.conf"] += `${machineName}[image]=icr/kathara-base`;
    }
    if (machine.type == "other" && machine.other && machine.other.image && machine.other.image !== "") {
      lab.file["lab.conf"] += `${machineName}[image]="${machine.other.image}"\n`;
      for (const [key, field] of Object.entries(machine.other.fields || {})) {
        if (key && field.value !== undefined && field.value !== "") {
          lab.file["lab.conf"] += `${machineName}[env]="${key}=${field.value}"\n`;
        }
      }
      for (const v of (machine.other.variables || [])) {
        if (v.a && v.b !== undefined && v.b !== "") {
          lab.file["lab.conf"] += `${machineName}[env]="${v.a}=${v.b}"\n`;
        }
      }
      // Kathara only supports one [volume] per machine; use the first user volume
      const otherVol = (machine.other.volumes || [])[0];
      if (otherVol?.a && otherVol?.b) {
        const { path, opts } = parseVolumeSrc(otherVol.a);
        const volStr = opts ? `${path}|${otherVol.b}|${opts}` : `${path}|${otherVol.b}`;
        lab.file["lab.conf"] += `${machineName}[volume]="${volStr}"\n`;
      }
      if (Array.isArray(machine.other.dockerFlags) && machine.other.dockerFlags.length > 0) {
        const opts = machine.other.dockerFlags
          .filter(f => f.flag && f.flag.trim())
          .map(f => f.value.trim() ? `${f.flag.trim()}=${f.value.trim()}` : f.flag.trim())
          .join(" ");
        if (opts) lab.file["lab.conf"] += `${machineName}[docker_options]="${opts}"\n`;
      }
    }
    if (machine.type == "ngfw") {
      lab.file["lab.conf"] += `${machineName}[image]=icr/ngfw\n`;

      const modbusProtect = machine.ngfw?.modbusProtect ? "yes" : "no";
      lab.file["lab.conf"] += `${machineName}[env]="REGISTRY_ADDR_PROTECT_BTN=${modbusProtect}"\n`;

      if (machine.ngfw?.modbusProtect && machine.ngfw?.modbusProtectAddr) {
        const protectedIps = Object.entries(machine.ngfw.modbusProtectAddr)
          .filter(([_, enabled]) => enabled)
          .map(([machineId, _]) => {
            const target = netkit.find((m) => m.id === machineId);
            if (target) {
              // Prefer eth1 ip if available, then eth0
              const eth1Interface = target.interfaces?.if?.find((i) => i.eth?.number === 1);
              if (eth1Interface && eth1Interface.ip) {
                return eth1Interface.ip.split("/")[0];
              }
              if (target.computedEth0Ip) {
                return target.computedEth0Ip.split("/")[0];
              }
            }
            return null;
          })
          .filter((ip) => ip)
          .join(",");

        if (protectedIps) {
          lab.file["lab.conf"] += `${machineName}[env]="REGISTRY_ADDR_PROTECT_ADDR=${protectedIps}"\n`;
        }
      }

      // && machine.ngfw.waf && machine.ngfw.waf.enabled

    }
    if (machine.type == "attacker") {
      if (machine.customAttackId && machine.attacker?.image) {
        lab.file["lab.conf"] += `${machineName}[image]="${machine.attacker.image}"\n`;
        for (const [key, field] of Object.entries(machine.attacker.fields || {})) {
          if (key && field.value !== undefined && field.value !== "") {
            lab.file["lab.conf"] += `${machineName}[env]="${key}=${field.value}"\n`;
          }
        }
        for (const v of (machine.attacker.variables || [])) {
          if (v.a && v.b !== undefined && v.b !== "") {
            lab.file["lab.conf"] += `${machineName}[env]="${v.a}=${v.b}"\n`;
          }
        }
        // Kathara only supports one [volume] per machine; use the first user volume
        const attackerVol = (machine.attacker.volumes || [])[0];
        if (attackerVol?.a && attackerVol?.b) {
          const { path, opts } = parseVolumeSrc(attackerVol.a);
          const volStr = opts ? `${path}|${attackerVol.b}|${opts}` : `${path}|${attackerVol.b}`;
          lab.file["lab.conf"] += `${machineName}[volume]="${volStr}"\n`;
        }
        if (Array.isArray(machine.attacker.dockerFlags) && machine.attacker.dockerFlags.length > 0) {
          const opts = machine.attacker.dockerFlags
            .filter(f => f.flag && f.flag.trim())
            .map(f => f.value.trim() ? `${f.flag.trim()}=${f.value.trim()}` : f.flag.trim())
            .join(" ");
          if (opts) lab.file["lab.conf"] += `${machineName}[docker_options]="${opts}"\n`;
        }
      } else if (machine.attackLoaded && machine.attackImage != "") {
        lab.file["lab.conf"] += `${machineName}[image]=${machine.attackImage}\n`;
        if (machine.attackImage.includes("modbustcp-injection")) {
          lab.file["lab.conf"] += `${machineName}[docker_options]="--privileged"\n`;
        }
      } else {
        lab.file["lab.conf"] += `${machineName}[image]=kalilinux/kali-rolling@sha256:eb500810d9d44236e975291205bfd45e9e19b7f63859e3a72ba30ea548ddb1df\n`;
      }
      lab.file["lab.conf"] += `${machineName}[hostname]="${machineName}"\n`;
    }
    lab.file["lab.conf"] += "\n";

    // Set ENDPOINT environment variable for industrial devices (fan, temperature_sensor)
    if (machine.type === "fan" || machine.type === "temperature_sensor") {
      let endpoint = "http://localhost:8000/";

      // If an engine is selected, find its IP address
      if (machine.industrial && machine.industrial.selectedEngineId) {
        const selectedEngine = netkit.find(m => m.id === machine.industrial.selectedEngineId);
        if (selectedEngine) {
          // Prefer the auto-assigned 20.x IP (Control Network)
          if (selectedEngine.computedEth0Ip) {
            const ipWithoutMask = selectedEngine.computedEth0Ip.split("/")[0];
            endpoint = `http://${ipWithoutMask}:8000/`;
          }
          // Fallback to the first configured interface (User Network) if for some reason eth0 wasn't assigned
          else if (selectedEngine.interfaces && selectedEngine.interfaces.if && selectedEngine.interfaces.if[0]) {
            const engineIp = selectedEngine.interfaces.if[0].ip;
            if (engineIp) {
              // Remove the subnet mask (e.g., "192.168.1.1/24" -> "192.168.1.1")
              const ipWithoutMask = engineIp.split("/")[0];
              endpoint = `http://${ipWithoutMask}:8000/`;
            }
          }
        }
      }

      // Set the ENDPOINT environment variable in lab.conf
      lab.file["lab.conf"] += `${machineName}[env]="ENDPOINT=${endpoint}"\n`;

      if (machine.type === "fan") {
        const capacity = machine.industrial?.capacity || "2.0";
        lab.file["lab.conf"] += `${machineName}[env]="CAPACITY=${capacity}"\n`;
      }

      if (machine.type === "temperature_sensor") {
        if (machine.industrial?.sineWave) {
          lab.file["lab.conf"] += `${machineName}[env]="SINE_WAVE=true"\n`;
          if (machine.industrial.period) lab.file["lab.conf"] += `${machineName}[env]="SINE_PERIOD=${machine.industrial.period}"\n`;
          if (machine.industrial.amplitude) lab.file["lab.conf"] += `${machineName}[env]="SINE_AMPLITUDE=${machine.industrial.amplitude}"\n`;
          if (machine.industrial.tempOffset) lab.file["lab.conf"] += `${machineName}[env]="SINE_OFFSET=${machine.industrial.tempOffset}"\n`;
        }
      }
    }
  }
}

/** ───────────────── Normalizzatore d’aiuto (se serve) ─────────────────
 * Se dal renderer arrivasse un formato semplificato, convertiamolo
 * in quello atteso da make.jsx: interfaces.if -> [{eth:{number,domain}}...]
 */
export function toNetkitFormat(machines) {
  // Se ha già interfaces.if con eth.number → lascio stare
  if (Array.isArray(machines) && machines[0]?.interfaces?.if?.[0]?.eth?.number !== undefined) {
    return machines.map(m => {
      const updatedInterfaces = m.interfaces.if.map((iface, idx) => ({
        ...iface,
        eth: { ...iface.eth, number: idx + 1 } // Adjust eth.number here
      }));

      const copy = {
        ...m,
        interfaces: { ...m.interfaces, if: updatedInterfaces }
      };

      // Fallback name for an unnamed attacker; a custom name is preserved.
      if (copy.type === "attacker" && !copy.name) {
        copy.name = "attacker";
      }
      return copy;
    });
  }

  // Se ha interfaces come lista ["A","B"] → converto
  const convertIfList = (ifs) =>
    (ifs || []).map((iface, idx) => ({
      eth: { number: idx + 1, domain: iface.domain }, // Increment idx by 1
      ip: iface.ip // Capture the IP here
    }));

  return (machines || []).map((m) => {
    const copy = {
      ...m,
      interfaces: m.interfaces?.if
        ? m.interfaces
        : { if: Array.isArray(m.interfaces) ? convertIfList(m.interfaces) : [] },
    };

    // Fallback name for an unnamed attacker; a custom name is preserved.
    if (copy.type === "attacker" && !copy.name) {
      copy.name = "attacker";
    }

    return copy;
  });
}

/** ───────────────── Funzione principale: genera ZIP in outPath ───────────────── */
export async function generateZipNode(machines, labInfo, outPath) {
  const netkit = toNetkitFormat(machines);

  // 🟢 Log per controllare cosa arriva
  const attackers = (netkit || []).filter(m => m.type === "attacker");
  console.log("🧪 attackers in input:", attackers.map(a => ({
    name: a.name,
    attackImage: a.attackImage,
    type: a.type
  })));

  // lab “virtuale” come nel renderer
  const lab = { file: {}, folders: [] };

  makeMachineFolders(netkit, lab);
  makeStartupFiles(netkit, lab);
  makeLabInfo(labInfo, lab);
  makeLabConfFile(netkit, lab);

  // ───────────────── SHARED FILES (PLC Program etc) ─────────────────
  for (const machine of netkit) {
    if (machine.type === 'plc' && machine.industrial && machine.industrial.plcProgramContent && machine.industrial.plcProgramName) {
      const rawContent = machine.industrial.plcProgramContent.split(';base64,').pop();
      if (rawContent) {
        // Use machine name for the file, keeping the original extension
        const originalName = machine.industrial.plcProgramName;
        const extension = originalName.includes('.') ? originalName.split('.').pop() : 'st';
        const machineName = String(machine.name || "plc").replace(/[^\w.-]/g, "_");
        const newFileName = `${machineName}.${extension}`;

        // Determine if we want to save it as text or binary. Buffer.from(..., 'base64') handles it correctly.
        lab.file[`shared/${newFileName}`] = Buffer.from(rawContent, 'base64');
      }
    }


    if (machine.type === 'netproxy') {
      const machineName = String(machine.name || "netproxy").replace(/[^\w.-]/g, "_");
      // Rules defined via the "Proxy Rules" form take precedence over an
      // uploaded config.json.
      if (Array.isArray(machine.netproxy?.rules) && machine.netproxy.rules.length > 0) {
        const rules = machine.netproxy.rules.map((r) => ({
          name: r.name || "proxy",
          proto: r.proto || "tcp",
          in_ip: r.in_ip,
          in_port: r.in_port,
          out_ip: r.out_ip,
          out_port: r.out_port,
          interceptors: Array.isArray(r.interceptors) ? r.interceptors : [],
        }));
        lab.file[`shared/${machineName}.json`] = Buffer.from(
          JSON.stringify({ rules }, null, 2),
          "utf8"
        );
      } else if (machine.netproxy?.configContent && machine.netproxy?.configName) {
        const rawContent = machine.netproxy.configContent.split(';base64,').pop();
        if (rawContent) {
          lab.file[`shared/${machineName}.json`] = Buffer.from(rawContent, 'base64');
        }
      }
    }

    if (machine.type === 'device' && Array.isArray(machine.device?.configs)) {
      // Config holders are not deployed, so their configs must not be shipped.
      if (isHolderDevice(machine)) continue;
      const machineName = String(machine.name || "device").replace(/[^\w.-]/g, "_");
      for (const cfg of machine.device.configs) {
        if (!cfg?.name || !cfg?.content) continue;
        const rawContent = String(cfg.content).split(';base64,').pop();
        if (!rawContent) continue;
        const safeFileName = String(cfg.name).replace(/[^\w.-]/g, "_");
        lab.file[`shared/${machineName}/${safeFileName}`] = Buffer.from(rawContent, 'base64');
      }
    }

    if (machine.type === 'scada') {
      console.log(`[DEBUG] Found SCADA machine: ${machine.name}`);
      console.log(`[DEBUG] Industrial props:`, machine.industrial ? "present" : "missing");
      if (machine.industrial) {
        console.log(`[DEBUG] scadaProjectName: ${machine.industrial.scadaProjectName}`);
        // console.log(`[DEBUG] scadaProjectContent length: ${machine.industrial.scadaProjectContent?.length}`); 
      }
    }

    if (machine.type === 'scada' && machine.industrial && machine.industrial.scadaProjectContent && machine.industrial.scadaProjectName) {
      const rawContent = machine.industrial.scadaProjectContent.split(';base64,').pop();
      if (rawContent) {
        // Save as shared/<machineName>.db
        const machineName = String(machine.name || "scada").replace(/[^\w.-]/g, "_");
        const newFileName = `${machineName}.db`;

        console.log(`[DEBUG] Adding SCADA file to zip: shared/${newFileName} (length: ${rawContent.length})`);
        lab.file[`shared/${newFileName}`] = Buffer.from(rawContent, 'base64');
      } else {
        console.log(`[DEBUG] Failed to extract base64 content`);
      }
    }
  }

  // Debug: list all files in lab.file
  console.log("[DEBUG] Files in lab.file:", Object.keys(lab.file));

  // costruzione ZIP
  const zip = new AdmZip();

  // cartelle (vuote) per ogni macchina
  for (const folder of lab.folders) {
    // AdmZip aggiunge file; per cartelle possiamo aggiungere un file placeholder opzionale
    // ma Kathara non lo richiede: i file .startup stanno in root del lab
  }

  // file in root
  for (const [name, content] of Object.entries(lab.file)) {
    zip.addFile(name, Buffer.from(content ?? "", "utf8"));
  }

  // scrivi su disco
  zip.writeZip(outPath);
}
