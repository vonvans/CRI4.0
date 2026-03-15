import React, { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@nextui-org/react";
import { api } from '../api';

export default function LogsModal({ isOpen, onClose, containerName }) {
    const [logs, setLogs] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !containerName) return;

        const fetchLogs = async () => {
            setLoading(true);
            try {
                console.log('Fetching logs for container:', containerName);
                const logsData = await api.getContainerLogs(containerName);
                console.log('Logs received:', logsData);
                setLogs(logsData);
            } catch (err) {
                console.error('Error fetching logs:', err);
                setLogs(`Error fetching logs: ${err.message || String(err)}`);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [isOpen, containerName]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="5xl"
            scrollBehavior="inside"
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            Logs: {containerName}
                        </ModalHeader>
                        <ModalBody>
                            {loading ? (
                                <div className="flex items-center justify-center h-96">
                                    <p className="text-zinc-500">Loading logs...</p>
                                </div>
                            ) : (
                                <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-md overflow-auto font-mono text-sm whitespace-pre-wrap" style={{ maxHeight: '600px' }}>
                                    {logs || 'No logs available'}
                                </pre>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={onClose}>
                                Close
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
