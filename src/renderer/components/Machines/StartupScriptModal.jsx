import React from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@nextui-org/react";
import { Textarea } from "@nextui-org/input";

export default function StartupScriptModal({ isOpen, onClose, machineName, value, onChange }) {
    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={onClose}
            size="5xl"
            scrollBehavior="inside"
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            Example startup script for {machineName}
                        </ModalHeader>
                        <ModalBody>
                            <Textarea
                                minRows={20}
                                maxRows={30}
                                label="Startup Script"
                                placeholder="Enter your startup script here..."
                                value={value}
                                onChange={onChange}
                                fullWidth
                                classNames={{
                                    input: "font-mono text-small",
                                }}
                            />
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={onClose}>
                                Close
                            </Button>
                            <Button color="primary" onPress={onClose}>
                                Done
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
