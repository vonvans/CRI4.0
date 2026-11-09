/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@nextui-org/react";
import { toast } from 'react-hot-toast';
import { MdContentCopy } from "react-icons/md";

export default function ModbusEndpointsModal({ isOpen, onClose, machineName, endpoints }) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            placement="center"
            size="lg"
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            Modbus endpoints — {machineName}
                        </ModalHeader>
                        <ModalBody>
                            {(!endpoints || endpoints.length === 0) ? (
                                <p className="text-sm text-default-500">
                                    No Modbus device configs found for this machine.
                                </p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {endpoints.map((ep) => (
                                        <div
                                            key={ep.name}
                                            className="flex flex-col gap-1 p-2 bg-default-100 rounded-lg"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold">{ep.name}</span>
                                                    <span className="text-xs text-default-500">{ep.deviceType}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <code className="text-sm">{ep.address}</code>
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant="light"
                                                        aria-label={`Copy ${ep.name} address`}
                                                        onPress={() => {
                                                            navigator.clipboard.writeText(ep.address);
                                                            toast.success(`${ep.address} copied`);
                                                        }}
                                                    >
                                                        <MdContentCopy className="text-base" />
                                                    </Button>
                                                </div>
                                            </div>
                                            {ep.variables?.length > 0 && (
                                                <div className="flex flex-col gap-0.5 pl-2 border-l-2 border-default-300">
                                                    {ep.variables.map((v) => (
                                                        <div key={v.name} className="flex items-center justify-between text-xs">
                                                            <span className="text-default-600">{v.name}</span>
                                                            <span className="text-default-500">
                                                                reg <code>{v.register}</code>{v.kind ? ` · ${v.kind}` : ""}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button color="primary" variant="light" onPress={onClose}>
                                Close
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
