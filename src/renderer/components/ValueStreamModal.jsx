import React, { useEffect, useRef, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Chip } from "@nextui-org/react";
import { api } from '../api';

// Live view of everything published on an MQTT broker. Polls the backend, which
// runs `mosquitto_sub -t '#' -v` inside the broker container and returns the
// accumulated output (topic + payload per line).
export default function ValueStreamModal({ isOpen, onClose, brokerName }) {
    const [output, setOutput] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const logsEndRef = useRef(null);

    const scrollToBottom = () => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchStream = async () => {
        try {
            const log = await api.getValueStream(brokerName);
            setOutput(log);
            setIsRunning(log.length > 0);
        } catch (error) {
            console.error("Failed to fetch value stream:", error);
        }
    };

    useEffect(() => {
        let interval;
        if (isOpen && brokerName) {
            fetchStream();
            interval = setInterval(fetchStream, 1500);
        }
        return () => clearInterval(interval);
    }, [isOpen, brokerName]);

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [output, isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1 text-primary">
                            <div className="flex items-center gap-2">
                                Value Stream: {brokerName}
                                {isRunning ? (
                                    <Chip color="success" variant="flat" size="sm" className="animate-pulse">LIVE</Chip>
                                ) : (
                                    <Chip color="default" variant="flat" size="sm">IDLE</Chip>
                                )}
                            </div>
                            <span className="text-zinc-500 text-xs font-normal italic">
                                mosquitto_sub -t &lsquo;#&rsquo; -v — every message published on the broker
                            </span>
                        </ModalHeader>
                        <ModalBody className="bg-zinc-950">
                            <pre className="text-zinc-100 p-3 rounded-md overflow-auto font-mono text-xs shadow-inner bg-black/40 whitespace-pre-wrap min-h-[450px]">
                                {output || 'Waiting for messages...\n(Subscribed to every topic on the broker. Publish something to see it here.)'}
                            </pre>
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
