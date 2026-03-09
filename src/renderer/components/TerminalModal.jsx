import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@nextui-org/react";
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { api } from '../api';

export default function TerminalModal({ isVisible, onMinimize, onClose, containerName }) {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const [instanceId, setInstanceId] = useState(null);

    // Track if it has been opened at least once to initialize
    const [hasRendered, setHasRendered] = useState(false);

    useEffect(() => {
        if (!isVisible && !hasRendered) return;
        setHasRendered(true);
    }, [isVisible, hasRendered]);

    useEffect(() => {
        if (!hasRendered || !terminalRef.current || !containerName) return;

        // If already initialized, just resize when visible
        if (xtermRef.current) {
            if (isVisible && fitAddonRef.current) {
                // Slight delay to allow display:block to apply and layout to calculate width/height
                setTimeout(() => fitAddonRef.current.fit(), 50);
            }
            return;
        }

        // Initialize xterm
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#1e1e1e',
                foreground: '#f0f0f0'
            },
            allowProposedApi: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Create terminal session in backend
        let activeInstanceId = null;
        let ptyUnsubscribe = null;

        const initSession = async () => {
            try {
                activeInstanceId = await api.terminalCreate(containerName);
                if (!activeInstanceId) return; // Prevent setting null if it failed silently
                setInstanceId(activeInstanceId);

                // Initial resize
                const { cols, rows } = fitAddon.proposeDimensions();
                api.terminalResize(activeInstanceId, cols, rows);

                // Send input to backend
                term.onData(data => {
                    api.terminalInput(activeInstanceId, data);
                });

                // Handle resize
                const handleResize = () => {
                    if (!activeInstanceId || !fitAddon) return;
                    fitAddon.fit();
                    const dims = fitAddon.proposeDimensions();
                    if (dims) {
                        api.terminalResize(activeInstanceId, dims.cols, dims.rows);
                    }
                };
                window.addEventListener('resize', handleResize);

                ptyUnsubscribe = () => window.removeEventListener('resize', handleResize);
            } catch (err) {
                term.writeln(`\r\nError connecting to terminal: ${err.message}\r\n`);
            }
        };

        initSession();

        // Subscribe to incoming data
        const unsubscribe = api.onTerminalData((id, data) => {
            if (id === activeInstanceId && xtermRef.current) {
                xtermRef.current.write(data);
            }
        });

        return () => {
            unsubscribe();
            if (ptyUnsubscribe) ptyUnsubscribe();

            if (activeInstanceId) {
                api.terminalKill(activeInstanceId);
            }
            if (xtermRef.current) {
                xtermRef.current.dispose();
                xtermRef.current = null;
            }
        };
    }, [hasRendered, containerName, isVisible]);

    if (!hasRendered) return null;

    return (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none p-4 sm:p-10 ${isVisible ? '' : 'hidden'}`}>
            <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto transition-opacity duration-300`} onClick={onMinimize}></div>

            <div className={`relative flex flex-col pointer-events-auto bg-[#18181b] w-full max-w-5xl rounded-large shadow-large overflow-hidden transition-all duration-300 scale-100 opacity-100`}>
                <div className="flex justify-between items-center px-6 py-4 border-b border-divider/10 bg-content1 shadow-sm relative z-10 w-full">
                    <span className="text-large font-semibold text-foreground">Terminal: {containerName}</span>
                    <div className="flex gap-2">
                        <Button isIconOnly variant="flat" size="sm" onPress={onMinimize}
                            className="bg-default-100 hover:bg-default-200 text-default-600"
                        >
                            <span className="font-bold text-lg leading-none transform -translate-y-[4px]">_</span>
                        </Button>
                        <Button isIconOnly variant="flat" size="sm" onPress={onClose}
                            className="bg-danger/20 hover:bg-danger/40 text-danger"
                        >
                            <span className="font-bold">X</span>
                        </Button>
                    </div>
                </div>

                <div className="p-4 sm:p-6 w-full h-[600px] max-h-[70vh] bg-[#1e1e1e]">
                    <div
                        ref={terminalRef}
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>
            </div>
        </div>
    );
}
