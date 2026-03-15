import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@nextui-org/react";

export default function UIModal({ isOpen, onClose, url, title }) {
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
                            {title || "UI View"}
                        </ModalHeader>
                        <ModalBody>
                            <div className="w-full h-[600px] bg-white rounded-md overflow-hidden">
                                {url ? (
                                    <iframe
                                        src={url}
                                        title="UI View"
                                        className="w-full h-full border-none"
                                        sandbox="allow-same-origin allow-scripts allow-forms"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        No URL provided
                                    </div>
                                )}
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <div className="flex-1 text-sm text-gray-500 self-center">
                                {url}
                            </div>
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
