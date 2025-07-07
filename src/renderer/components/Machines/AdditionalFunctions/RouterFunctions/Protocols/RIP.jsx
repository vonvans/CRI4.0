/* eslint-disable react/no-array-index-key */
/* eslint-disable no-else-return */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import {Select, SelectItem} from "@nextui-org/select";
import { Checkbox, CheckboxGroup, Divider, Textarea } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { Input } from "@nextui-org/react";
import { PlusSymbol } from "../../../../Symbols/PlusSymbol";
import { MinusSymbol } from "../../../../Symbols/MinusSymbol";

export function RIP({machine, machines, setMachines}) {
    function addNetwork(e, data){
        setMachines(() => (
            machines.map(m => {
                if (m.id === machine.id){
                    return {
                        ...m,
                        routing: {
                            ...machine.routing,
                            rip: data
                        }
                    }
                } else {
                    return m
                }
            })
        ))
    }

    function removeNetwork(e, data){
        setMachines(() => (
            machines.map(m => {
                if (m.id === machine.id){
                    return {
                        ...m,
                        routing: {
                            ...machine.routing,
                            rip: data
                        }
                    }
                } else {
                    return m
                }
            })
        ))
    }

    function handleChangeRouting(e, data){
        setMachines(() => (
            machines.map(m => {
                if (m.id === machine.id){
                    return {
                        ...m,
                        routing: data
                    }
                } else {
                    return m
                }
            })
        ))
    }

    return (
        <div>
            {machine.routing.rip.en &&
            <div className="grid content-start gap-2">
                <div className="grid gap-2">
                    <div className="grid grid-cols-2 grid-rows-1 gap-2">
                        <Button onClick={(e) => addNetwork(e, {
                                ...machine.routing.rip,
                                network: [...machine.routing.rip.network, ""]
                            })} aria-label="Add Gateway" size="sm" color="success">
                                <PlusSymbol fill="white" size={22} />
                        </Button>
                        <Button isDisabled={machine.routing.rip.network.length <= 1} onClick={(e) => removeNetwork(e, {
                                ...machine.routing.rip,
                                network: machine.routing.rip.network.slice(0, machine.routing.rip.network.length - 1),
                            })} aria-label="Remove Gateway" size="sm" color="danger">
                                <MinusSymbol fill="white" size={22} />
                        </Button>
                    </div>
                    {machine.routing.rip.network.map((n, index) => (
                        <Input
                            key={index}
                            type="text"
                            variant="flat"
                            label="Network"
                            placeholder="0.0.0.0/0"
                            value={n}
                            onChange={(e) => handleChangeRouting(e, {
                                ...machine.routing,
                                rip: {
                                    ...machine.routing.rip,
                                    network: machine.routing.rip.network.map((el, idx) => {
                                        if (idx === index){
                                            return e.target.value
                                        } else {
                                            return el
                                        }
                                    })
                                }
                            })}
                        />
                    ))}
                </div>
                <Divider />
                <div className="grid gap-2">
                    <div className="grid grid-cols-2 grid-rows-1 gap-2">
                        <Button onClick={(e) => addNetwork(e, {
                            ...machine.routing.rip,
                            route: [...machine.routing.rip.route, ""]
                        })} aria-label="Add Gateway" size="sm" color="success">
                                <PlusSymbol fill="white" size={22} />
                        </Button>
                        <Button isDisabled={machine.routing.rip.route.length <= 1} onClick={(e) => removeNetwork(e, {
                            ...machine.routing.rip,
                            route: machine.routing.rip.route.slice(0, machine.routing.rip.route.length - 1),
                        })} aria-label="Remove Gateway" size="sm" color="danger">
                                <MinusSymbol fill="white" size={22} />
                        </Button>
                    </div>
                    {machine.routing.rip.route.map((n, index) => (
                        <Input
                            key={index}
                            type="text"
                            variant="flat"
                            label="Route"
                            description="empty to omit"
                            placeholder="0.0.0.0/0"
                            value={n}
                            onChange={(e) => handleChangeRouting(e, {
                                ...machine.routing,
                                rip: {
                                    ...machine.routing.rip,
                                    route: machine.routing.rip.route.map((el, idx) => {
                                        if (idx === index){
                                            return e.target.value
                                        } else {
                                            return el
                                        }
                                    })
                                }
                            })}
                        />
                    ))}
                </div>
                <div className="grid gap-2">
                        <Checkbox
                            isSelected={machine.routing.rip.ospf}
                            onValueChange={(value) => handleChangeRouting(value, {
                                ...machine.routing,
                                rip: {
                                    ...machine.routing.rip,
                                    ospf: value
                                }
                            })}
                        >Redistribute OSPF</Checkbox>
                        <Checkbox
                            isSelected={machine.routing.rip.bpg}
                            onValueChange={(value) => handleChangeRouting(value, {
                                ...machine.routing,
                                rip: {
                                    ...machine.routing.rip,
                                    bpg: value
                                }
                            })}
                        >Redistribute BGP</Checkbox>
                        <Checkbox
                            isSelected={machine.routing.rip.connected}
                            onValueChange={(value) => handleChangeRouting(value, {
                                ...machine.routing,
                                rip: {
                                    ...machine.routing.rip,
                                    connected: value
                                }
                            })}
                        >Redistribute connected</Checkbox>
                </div>
                {machine.routingSoftware === "frr" &&
                    <Textarea
                        label="Directly after rip config in frr.conf"
                        labelPlacement="outside"
                        value={machine.routing.rip.free}
                        onValueChange={(value) => handleChangeRouting(value, {
                            ...machine.routing,
                            rip: {
                                ...machine.routing.rip,
                                free: value
                            }
                        })}
                    />
                || machine.routingSoftware === "quagga" &&
                    <Textarea
                        label="Directly in ripfd.conf"
                        labelPlacement="outside"
                        value={machine.routing.rip.free}
                        onValueChange={(value) => handleChangeRouting(value, {
                            ...machine.routing,
                            rip: {
                                ...machine.routing.rip,
                                free: value
                            }
                        })}
                    />
                }
                <Divider />
            </div>
            }
        </div>
    )
}
