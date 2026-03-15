/* eslint-disable react/no-array-index-key */
/* eslint-disable no-unneeded-ternary */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-else-return */
/* eslint-disable eqeqeq */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { useState, useEffect } from "react";
import { RadioGroup, Radio } from "@nextui-org/radio";
import { Input } from "@nextui-org/input";
import { Divider } from "@nextui-org/divider";
import { Textarea } from "@nextui-org/input";
import { Button } from "@nextui-org/button";
import { PlusSymbol } from '../Symbols/PlusSymbol';
import { MinusSymbol } from '../Symbols/MinusSymbol';
import StartupScriptModal from "./StartupScriptModal";

export function NetworkInterface({ machine, machines, setMachines }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    function addInterface() {
        setMachines(() => (
            machines.map(m => {
                if (m.id == machine.id) {
                    return {
                        ...m,
                        interfaces: {
                            ...m.interfaces,
                            if: [
                                ...m.interfaces.if,
                                {
                                    eth: {
                                        number: m.interfaces.counter,
                                        domain: "",
                                    },
                                    ip: "",
                                }
                            ],
                            counter: m.interfaces.counter + 1
                        },
                        routing: {
                            ...m.routing,
                            ospf: {
                                ...m.routing.ospf,
                                if: [...m.routing.ospf.if, {
                                    cost: 0,
                                    interface: null
                                }]
                            }
                        }
                    }
                } else {
                    return m
                }
            })
        ))
    }

    function removeInterface() {
        setMachines(() => (
            machines.map(m => {
                if (m.id == machine.id) {
                    return {
                        ...m,
                        interfaces: {
                            ...m.interfaces,
                            if: m.interfaces.if.slice(0, m.interfaces.if.length - 1),
                            counter: m.interfaces.counter - 1
                        }
                    }
                } else {
                    return m
                }
            })
        ))
    }

    function handleChange(e, index, data) {
        setMachines((machines) => (
            machines.map(m => {
                if (m.id == machine.id) {
                    return {
                        ...m,
                        interfaces: {
                            ...m.interfaces,
                            if: m.interfaces.if.map((i) => {
                                if (i.eth.number == index) {
                                    return data
                                } else {
                                    return i
                                }
                            })
                        }
                    }
                } else {
                    return m
                }
            })
        ))
    }

    function handleScriptChange(e) {
        setMachines((machines) => (
            machines.map(m => {
                if (m.id == machine.id) {
                    return {
                        ...m,
                        interfaces: {
                            ...m.interfaces,
                            free: e.target.value
                        },
                        scripts: {
                            ...(m.scripts ?? {}),   // backward-compat se manca
                            startup: e.target.value,
                        }

                    }
                } else {
                    return m
                }
            })
        ))
    }

    const IsSwitch = ({ machine }) => {

    }

    const IsController = ({ machine }) => {

    }


    return (
        <div className="h-full">
            <StartupScriptModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                machineName={machine.name}
                value={machine.scripts?.startup || ""}
                onChange={(e) => handleScriptChange(e)}
            />
            <div className="grid content-start gap-2">
                <div>
                    {(machine.type == "controller" || machine.type == "switch") && (
                        <p className="p-2 text-text/50">Connection between switches and controller is automatically configured</p>
                    ) || (
                            <div className="grid gap-2">
                                <div className="grid grid-cols-2 grid-rows-1 gap-2">
                                    <Button onClick={addInterface} aria-label="Add Interface" size="sm" color="success">
                                        <PlusSymbol fill="white" size={22} />
                                    </Button>
                                    <Button isDisabled={machine.interfaces.counter > 1 ? false : true} onClick={removeInterface} aria-label="Remove Interface" size="sm" color="danger">
                                        <MinusSymbol fill="white" size={22} />
                                    </Button>
                                </div>
                                <div className="grid gap-2">
                                    {machines.find((m) => m.id === machine.id)
                                        .interfaces.if.map((i, index) => (
                                            <div className="grid gap-2" key={index}>
                                                <Input
                                                    type="text"
                                                    variant="flat"
                                                    label={`eth${index}`}
                                                    placeholder="A"
                                                    value={i.eth.domain || ""}
                                                    onChange={(e) => handleChange(e, index, {
                                                        ...i,
                                                        eth: {
                                                            ...i.eth,
                                                            domain: e.target.value
                                                        }
                                                    })}
                                                />
                                                <Input
                                                    type="text"
                                                    variant="flat"
                                                    label="IP Address/Net"
                                                    placeholder="0.0.0.0/0"
                                                    value={i.ip || ""}
                                                    onChange={(e) => handleChange(e, index, {
                                                        ...i,
                                                        ip: e.target.value
                                                    })}
                                                />
                                                <Input
                                                    type="text"
                                                    variant="flat"
                                                    label="Complete DNS Name"
                                                    placeholder="www.x.y or ROOT-SERVER"
                                                    value={i.name || ""}
                                                    onChange={(e) => handleChange(e, index, {
                                                        ...i,
                                                        name: e.target.value
                                                    })}
                                                />
                                                <Divider />
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                </div>
                <div>
                    {(machine.type == "switch") && (
                        <div className="grid gap-2">
                            <div className="grid grid-cols-2 grid-rows-1 gap-2">
                                <Button onClick={addInterface} aria-label="Add Interface" size="sm" color="success">
                                    <PlusSymbol fill="white" size={22} />
                                </Button>
                                <Button isDisabled={machine.interfaces.counter > 1 ? false : true} onClick={removeInterface} aria-label="Remove Interface" size="sm" color="danger">
                                    <MinusSymbol fill="white" size={22} />
                                </Button>
                            </div>
                            <div className="grid gap-2">
                                {machines.find((m) => m.id === machine.id)
                                    .interfaces.if.map((i, index) => (
                                        <div className="grid gap-2" key={index}>
                                            <Input
                                                type="text"
                                                variant="flat"
                                                label={`eth${index}`}
                                                placeholder="A"
                                                value={i.eth.domain || ""}
                                                onChange={(e) => handleChange(e, index, {
                                                    ...i,
                                                    eth: {
                                                        ...i.eth,
                                                        domain: e.target.value
                                                    }
                                                })}
                                            />
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="row-span-1 mt-2 relative">
                <Textarea
                    type="text"
                    variant="flat"
                    label={`Directly in ${machine.name}.startup`}
                    placeholder=" "
                    value={machine.scripts?.startup || ""}  // fallback sicuro
                    //value={machine.interfaces.free || ""}
                    onChange={handleScriptChange}
                />
                <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="absolute top-2 right-2 z-10"
                    onClick={() => setIsModalOpen(true)}
                >
                    ↗
                </Button>
            </div>
        </div>
    )
}
