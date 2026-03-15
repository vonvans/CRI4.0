import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { router } from './routes';
import path from 'path';

import os from 'os';
import { promises as fsp } from 'fs';
import { spawn, exec } from 'child_process';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Helper to run commands
function runCmd(cmd: string, args: string[], opts: { cwd?: string, timeoutMs?: number } = {}) {
    return new Promise<string>((resolve, reject) => {
        const child = spawn(cmd, args, {
            cwd: opts.cwd || process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let out = '';
        let err = '';
        let timedOut = false;

        const timer = opts.timeoutMs
            ? setTimeout(() => {
                timedOut = true;
                try { child.kill('SIGKILL'); } catch { }
            }, opts.timeoutMs)
            : null;

        child.stdout.on('data', d => (out += d.toString()));
        child.stderr.on('data', d => (err += d.toString()));

        child.on('close', code => {
            if (timer) clearTimeout(timer);
            if (timedOut) return reject(new Error('command timeout'));
            if (code === 0) return resolve(out.trim());
            reject(new Error(err || `exit ${code}`));
        });

        child.on('error', e => {
            if (timer) clearTimeout(timer);
            reject(e);
        });
    });
}

// Cleanup function
async function cleanupLabs() {
    const labsDir = path.join(os.homedir(), 'kathara-labs');
    try {
        console.log('🧹 Startup: cleaning previous labs...');
        // 1. Stop simulations
        await runCmd('kathara', ['lclean', '-d', labsDir], { timeoutMs: 20_000 });

        // 2. Remove directory
        await fsp.rm(labsDir, { recursive: true, force: true });
        console.log('✅ Startup: removed labs directory');
    } catch (e) {
        console.error('❌ Startup cleanup failed:', e);
    }
}

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
});

// Serve static files from the React app (if built) or just API for now
// In development, we'll run this alongside the webpack dev server.
// In production web mode, we might want to serve static files too.

app.use('/api', router);

// Serve static assets if needed, similar to how Electron does it
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

// Start server after cleanup
let server: any;
cleanupLabs().then(() => {
    server = app.listen(PORT, '127.0.0.1', () => {
        console.log(`Server running on port ${PORT}`);
    });
    server.setTimeout(300000); // 5 minutes timeout for long docker builds

    // Initialize Socket.IO now that server is ready
    setupSocketIO(server);
});

import { Server } from 'socket.io';
import * as pty from 'node-pty';
import { IPty } from 'node-pty';

function setupSocketIO(httpServer: any) {
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    const terminals = new Map<string, IPty>();

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('terminal.create', async (containerNameInput, callback) => {
            const shell = 'docker';
            let targetContainer = '';

            // Strip "machine-" prefix coming from frontend graph ID
            let containerName = containerNameInput;
            if (containerName.startsWith('machine-')) {
                containerName = containerName.substring(8);
            }

            try {
                const ancestorName = await new Promise<string>((resolve, reject) => {
                    const cmd1 = `docker ps --filter ancestor=${containerName} --format "{{.Names}}"`;
                    exec(cmd1, (err, stdout) => {
                        const name = stdout ? stdout.trim().split("\n")[0] : null;
                        if (name) {
                            resolve(name);
                        } else {
                            const cmd2 = `docker ps --filter name=_${containerName}_ --format "{{.Names}}"`;
                            exec(cmd2, (err2, stdout2) => {
                                const name2 = stdout2 ? stdout2.trim().split("\n")[0] : null;
                                if (name2) {
                                    resolve(name2);
                                } else {
                                    reject('Container not found');
                                }
                            });
                        }
                    });
                });
                targetContainer = ancestorName;
            } catch (e: any) {
                console.error(`Terminal creation failed: ${e}`);
                let verifyError = String(e);
                if (verifyError.includes('permission denied') || verifyError.includes('connect to the docker API')) {
                    verifyError = "Docker permission denied. Please add your user to the docker group: sudo usermod -aG docker $USER";
                }
                if (typeof callback === 'function') callback({ error: verifyError });
                return;
            }

            const ptyProcess = pty.spawn(shell, ['exec', '-it', targetContainer, '/bin/bash'], {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: process.env.HOME,
                env: process.env as any
            });

            const id = Date.now().toString();
            terminals.set(id, ptyProcess);

            ptyProcess.onData((data) => {
                socket.emit('terminal.incoming', { id, data });
            });

            ptyProcess.onExit(() => {
                terminals.delete(id);
                socket.emit('terminal.incoming', { id, data: '\r\n[Process exited]\r\n' });
            });

            if (typeof callback === 'function') callback({ id });
        });

        socket.on('terminal.input', ({ id, data }) => {
            const term = terminals.get(id);
            if (term) {
                term.write(data);
            }
        });

        socket.on('terminal.resize', ({ id, cols, rows }) => {
            const term = terminals.get(id);
            if (term) {
                term.resize(cols, rows);
            }
        });

        socket.on('terminal.kill', (id) => {
            const term = terminals.get(id);
            if (term) {
                term.kill();
                terminals.delete(id);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            // Optionally kill terminals related to this socket if we tracked ownership
        });
    });
}
