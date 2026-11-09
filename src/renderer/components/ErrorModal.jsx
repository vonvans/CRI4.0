import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@nextui-org/react";

export default function ErrorModal({ isOpen, onClose, message }) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            placement="center"
            size="2xl"
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1 text-danger">Simulation Error</ModalHeader>
                        <ModalBody>
                            <pre className="text-sm bg-default-100 p-4 rounded-lg whitespace-pre-wrap max-h-96 overflow-y-auto w-full">
                                {message}
                            </pre>
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
