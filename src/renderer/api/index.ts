import type { Channels } from '../../main/preload';

const BASE_URL = 'http://localhost:3001';
export const API_BASE_URL = `${BASE_URL}/api`;

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
    assetsUrl: isElectron() ? 'icr://images/' : `${BASE_URL}/assets/images/`,

    async getDockerImages(): Promise<string[]> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('docker-images');
        }
        const response = await fetch(`${API_BASE_URL}/docker-images`);
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
        const data = await response.json();
        return data.output;
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
