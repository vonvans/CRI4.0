import type { Channels } from '../../main/preload';

const BASE_URL = isElectronProcess() ? 'http://localhost:3001' : '';
export const API_BASE_URL = `${BASE_URL}/api`;

function isElectronProcess() {
    try { return !!(window as any).electron; } catch { return false; }
}

const isElectron = () => !!(window.electron);

import { io, Socket } from 'socket.io-client';
let socket: Socket | null = null;

function getSocket() {
    if (!socket) {
        socket = io(BASE_URL);
    }
    return socket;
}

export const api = {
    isElectron: isElectron(),
    assetsUrl: isElectron() ? 'icr://images/' : 'http://localhost:3001/assets/images/',

    async dockerSearch(query: string): Promise<any[]> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('docker-search', query);
        }
        const response = await fetch(`${API_BASE_URL}/docker-search?q=${encodeURIComponent(query)}`);
        return response.json();
    },

    async getAllLocalImages(): Promise<string[]> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('all-docker-images');
        }
        const response = await fetch(`${API_BASE_URL}/all-docker-images`);
        return response.json();
    },

    async getDockerImages(): Promise<string[]> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('docker-images');
        }
        const response = await fetch(`${API_BASE_URL}/docker-images`);
        return response.json();
    },

    async loadDockerImage(file?: File): Promise<{ tag?: string; error?: string; canceled?: boolean }> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('load-docker-image');
        }
        if (!file) return { error: 'No file provided' };
        const response = await fetch(`${API_BASE_URL}/load-docker-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: file,
        });
        return response.json();
    },

    async buildCustomImage(machineName: string, baseImage: string, buildScript: string): Promise<{ started: boolean; buildId: string }> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('build-custom-image', { machineName, baseImage, buildScript });
        }
        const response = await fetch(`${API_BASE_URL}/build-custom-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ machineName, baseImage, buildScript }),
        });
        return response.json();
    },

    async getBuildResult(buildId: string): Promise<{ done: boolean; success?: boolean; image?: string; dockerOutput?: string; scriptStdout?: string; scriptStderr?: string }> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('get-build-result', buildId);
        }
        const response = await fetch(`${API_BASE_URL}/build-result/${encodeURIComponent(buildId)}`);
        return response.json();
    },

    async buildDockerImage(name: string): Promise<string[]> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('docker-build', name);
        }
        const response = await fetch(`${API_BASE_URL}/docker-build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        return response.json();
    },

    async getContainerInspect(containerName: string): Promise<any[]> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('docker-inspect', containerName);
        }
        const response = await fetch(`${API_BASE_URL}/docker-inspect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ containerName }),
        });
        return response.json();
    },

    async getContainerLogs(containerName: string): Promise<string> {
        console.log('getContainerLogs called with:', containerName);
        console.log('isElectron:', isElectron());

        if (isElectron()) {
            try {
                const result = await window.electron.ipcRenderer.invoke('docker-logs', containerName);
                console.log('IPC result:', result);
                return result;
            } catch (error) {
                console.error('IPC error:', error);
                throw error;
            }
        }
        const response = await fetch(`${API_BASE_URL}/docker-logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ containerName }),
        });
        const data = await response.json();
        return data.logs || '';
    },

    async simulateAttack(container: string, command: string | string[]): Promise<string> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('simulate-attack', { container, command });
        }
        const response = await fetch(`${API_BASE_URL}/simulate-attack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ container, command }),
        });
        const data = await response.json();
        return data.output;
    },

    async runSimulation(machines: any[], labInfo: any, sudoPassword?: string): Promise<string> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('run-simulation', { machines, labInfo, sudoPassword });
        }
        const response = await fetch(`${API_BASE_URL}/run-simulation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ machines, labInfo, sudoPassword }),
        });

        if (response.status === 500) {
            const errorText = await response.text();
            console.error('500 Internal Server Error:', errorText);
            throw new Error(`500 Internal Server Error: ${errorText}`);
        }

        const data = await response.json();
        return data.output;
    },

    async arkimeStatsUrls(): Promise<{ general: string; sessions: string; packets: string; connections: string }> {
        if (isElectron()) {
            const { urls } = await window.electron.ipcRenderer.invoke('arkime-stats-url');
            return urls;
        }
        const response = await fetch(`${API_BASE_URL}/arkime-stats-url`, { method: 'POST' });
        const data = await response.json();
        return data.urls;
    },

    async arkimeNetFlow(ips: string[]): Promise<string> {
        if (isElectron()) {
            const { url } = await window.electron.ipcRenderer.invoke('arkime-netflow', ips);
            return url;
        }
        const response = await fetch(`${API_BASE_URL}/arkime-netflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ips }),
        });
        const data = await response.json();
        return data.url;
    },

    async stopSimulation(): Promise<string> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('stop-simulation');
        }
        const response = await fetch(`${API_BASE_URL}/stop-simulation`, {
            method: 'POST',
        });
        const data = await response.json();
        return data.output;
    },

    async saveScadaProject(machineName: string): Promise<string> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('save-scada-project', machineName);
        }

        const response = await fetch(`${API_BASE_URL}/save-scada-project`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ machineName }),
        });
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data.output;
    },

    async queryLokiLogs(queryParams: string): Promise<any> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('loki-query', queryParams);
        }
        const response = await fetch(`${API_BASE_URL}/loki-query?${queryParams}`);
        if (!response.ok) {
            let text = '';
            try { text = await response.text(); } catch (e) {}
            throw new Error(`Loki query failed: ${response.status} ${text}`);
        }
        return response.json();
    },

    async deleteLokiLogs(query: string, start: string, end: string): Promise<void> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('loki-delete', { query, start, end });
        }
        const response = await fetch(`${API_BASE_URL}/loki-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, start, end }),
        });
        if (!response.ok) {
            let text = '';
            try { text = await response.text(); } catch (e) {}
            throw new Error(`Loki delete failed: ${response.status} ${text}`);
        }
    },

    subscribeToLogs(callback: (level: string, message: string) => void): () => void {
        if (isElectron()) {
            return window.electron.ipcRenderer.on('log-message', (arg: any) => {
                const { level, message } = arg as { level: string; message: string };
                callback(level, message);
            });
        } else {
            const eventSource = new EventSource(`${API_BASE_URL}/logs`);
            eventSource.onmessage = (event) => {
                try {
                    const { level, message } = JSON.parse(event.data);
                    callback(level, message);
                } catch (e) {
                    console.error('Failed to parse log message', e);
                }
            };
            return () => {
                eventSource.close();
            };
        }
    },

    async getAttackStatus(): Promise<{ isRunning: boolean; output: string }> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('get-attack-status');
        }
        const response = await fetch(`${API_BASE_URL}/attack-status`);
        return response.json();
    },
    async clearAttackStatus(): Promise<void> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('clear-attack-status');
        }
        await fetch(`${API_BASE_URL}/attack-clear`, { method: 'POST' });
    },
    async getAttackLog(container: string): Promise<string> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('attack-log-read', container);
        }
        const response = await fetch(`${API_BASE_URL}/attack-log-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ container }),
        });
        const data = await response.json();
        return data.log || '';
    },
    async getValueStream(container: string): Promise<string> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('value-stream-read', container);
        }
        const response = await fetch(`${API_BASE_URL}/value-stream-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ container }),
        });
        const data = await response.json();
        return data.log || '';
    },
    // --- Terminal API ---
    async terminalCreate(container: string): Promise<string> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('terminal.create', container);
        }

        // Web Mode: Use Socket.io
        const socket = getSocket();
        return new Promise((resolve, reject) => {
            socket.emit('terminal.create', container, (response: any) => {
                if (response.error) {
                    reject(response.error);
                } else {
                    resolve(response.id);
                }
            });
        });
    },

    terminalInput(id: string, data: string): void {
        if (isElectron()) {
            window.electron.ipcRenderer.sendMessage('terminal.input', { id, data });
        } else {
            getSocket().emit('terminal.input', { id, data });
        }
    },

    terminalResize(id: string, cols: number, rows: number): void {
        if (isElectron()) {
            window.electron.ipcRenderer.sendMessage('terminal.resize', { id, cols, rows });
        } else {
            getSocket().emit('terminal.resize', { id, cols, rows });
        }
    },

    terminalKill(id: string): void {
        if (isElectron()) {
            window.electron.ipcRenderer.invoke('terminal.kill', id);
        } else {
            getSocket().emit('terminal.kill', id);
        }
    },

    onTerminalData(callback: (id: string, data: string) => void): () => void {
        if (isElectron()) {
            return window.electron.ipcRenderer.on('terminal.incoming', (arg: any) => {
                const { id, data } = arg;
                callback(id, data);
            });
        }

        const socket = getSocket();
        const handler = (arg: any) => {
            const { id, data } = arg;
            callback(id, data);
        };
        socket.on('terminal.incoming', handler);
        return () => {
            socket.off('terminal.incoming', handler);
        };
    }
};
