import React, { useEffect, useRef, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Chip } from "@nextui-org/react";
import { api } from '../api';

export default function AttackStatusModal({ isOpen, onClose, attackerName, isCustomAttack }) {
    const [attackOutput, setAttackOutput] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const logsEndRef = useRef(null);

    const scrollToBottom = () => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchStatus = async () => {
        try {
            if (isCustomAttack) {
                const log = await api.getAttackLog(attackerName || "attacker");
                setAttackOutput(log);
                // consider running if pid file exists (heuristic: non-empty log and no [finished] marker)
                setIsRunning(log.length > 0);
            } else {
                const data = await api.getAttackStatus();
                setAttackOutput(data.output);
                setIsRunning(data.isRunning);
            }
        } catch (error) {
            console.error("Failed to fetch attack status:", error);
        }
    };

    useEffect(() => {
        let interval;
        if (isOpen) {
            fetchStatus();
            interval = setInterval(fetchStatus, 1500);
        }
        return () => clearInterval(interval);
    }, [isOpen, isCustomAttack]);

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [attackOutput, isOpen]);

    const handleClear = async () => {
        if (!isCustomAttack) {
            await api.clearAttackStatus();
        }
        setAttackOutput("");
    };

    const fetchDirectLogs = async () => {
        setIsLoading(true);
        try {
            const result = await api.getContainerLogs(attackerName);
            setAttackOutput(prev => prev + "\n--- Manual Container Logs Sync ---\n" + result);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1 text-danger">
                            <div className="flex items-center gap-2">
                                Attack Status: {attackerName}
                                {isRunning ? (
                                    <Chip color="success" variant="flat" size="sm" className="animate-pulse">RUNNING</Chip>
                                ) : (
                                    <Chip color="default" variant="flat" size="sm">IDLE</Chip>
                                )}
                                {isCustomAttack && (
                                    <Chip color="secondary" variant="flat" size="sm">CUSTOM</Chip>
                                )}
                            </div>
                            <span className="text-zinc-500 text-xs font-normal italic">
                                {isCustomAttack ? "Live output from /attack.log" : "Direct execution output from your attack script..."}
                            </span>
                        </ModalHeader>
                        <ModalBody className="bg-zinc-950">
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2 mb-2">
                                    {!isCustomAttack && (
                                        <Button size="sm" color="primary" variant="flat" onPress={fetchDirectLogs} isLoading={isLoading}>
                                            Sync Docker Logs
                                        </Button>
                                    )}
                                    <Button size="sm" color="default" variant="flat" onPress={handleClear}>
                                        Clear Window
                                    </Button>
                                </div>
                                <pre className="text-zinc-100 p-3 rounded-md overflow-auto font-mono text-xs shadow-inner bg-black/40 whitespace-pre-wrap min-h-[450px]">
                                    {attackOutput || (isCustomAttack
                                        ? 'Waiting for /attack.log...\n(Click "Start Attack" in the Topology to run /attack.sh)'
                                        : 'Waiting for attack execution output...\n(Click "Start Attack" in the Topology or Attack page)')}
                                </pre>
                            </div>
                            <div ref={logsEndRef} />
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={onClose}>Close</Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
