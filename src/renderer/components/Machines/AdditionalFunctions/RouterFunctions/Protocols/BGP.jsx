/* eslint-disable react/no-array-index-key */
/* eslint-disable no-else-return */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import {Select, SelectItem} from "@nextui-org/select";
import { Checkbox, CheckboxGroup, Divider, Textarea } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { Input } from "@nextui-org/react";
import { PlusSymbol } from "../../../../Symbols/PlusSymbol";
import { MinusSymbol } from "../../../../Symbols/MinusSymbol";

export function BGP({machine, machines, setMachines}) {
    function addNetwork(e, data){
        setMachines(() => (
            machines.map(m => {
                if (m.id === machine.id){
                    return {
                        ...m,
                        routing: {
                            ...machine.routing,
                            bgp: data
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
                            bgp: data
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
            {machine.routing.bgp.en &&
            <div className="grid content-start gap-2">
                <div className="grid gap-2">
                    <div className="grid grid-cols-2 grid-rows-1 gap-2">
                        <Button onClick={(e) => addNetwork(e, {
                                ...machine.routing.bgp,
                                network: [...machine.routing.bgp.network, ""]
                            })} aria-label="Add Gateway" size="sm" color="success">
                                <PlusSymbol fill="white" size={22} />
                        </Button>
                        <Button isDisabled={machine.routing.bgp.network.length <= 1} onClick={(e) => removeNetwork(e, {
                                ...machine.routing.bgp,
                                network: machine.routing.bgp.network.slice(0, machine.routing.bgp.network.length - 1),
                            })} aria-label="Remove Gateway" size="sm" color="danger">
                                <MinusSymbol fill="white" size={22} />
                        </Button>
                    </div>
                    {machine.routing.bgp.network.map((n, index) => (
                        <Input
                            key={index}
                            type="text"
                            variant="flat"
                            label="Network"
                            placeholder="0.0.0.0/0"
                            value={n}
                            onChange={(e) => handleChangeRouting(e, {
                                ...machine.routing,
                                bgp: {
                                    ...machine.routing.bgp,
                                    network: machine.routing.bgp.network.map((el, idx) => {
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
                            ...machine.routing.bgp,
                            remote: [...machine.routing.bgp.remote, {
                                neighbor: "",
                                as: "",
                                description: "",
                              }
                            ]
                        })} aria-label="Add Gateway" size="sm" color="success">
                                <PlusSymbol fill="white" size={22} />
                        </Button>
                        <Button isDisabled={machine.routing.bgp.remote.length <= 1} onClick={(e) => removeNetwork(e, {
                            ...machine.routing.bgp,
                            remote: machine.routing.bgp.remote.slice(0, machine.routing.bgp.remote.length - 1),
                        })} aria-label="Remove Gateway" size="sm" color="danger">
                                <MinusSymbol fill="white" size={22} />
                        </Button>
                    </div>
                    {machine.routing.bgp.remote.map((element, index) => (
                        <div className="grid gap-2" key={index}>
                            <Input
                                type="text"
                                variant="flat"
                                label="Neighbor"
                                description="empty to omit"
                                placeholder="0.0.0.0/0"
                                value={element.neighbor}
                                onChange={(e) => handleChangeRouting(e, {
                                    ...machine.routing,
                                    bgp: {
                                        ...machine.routing.bgp,
                                        remote: machine.routing.bgp.remote.map((el, idx) => {
                                            if (idx === index){
                                                return {
                                                    ...el,
                                                    neighbor: e.target.value
                                                }
                                            } else {
                                                return el
                                            }
                                        })
                                    }
                                })}
                            />
                            <Input
                                type="text"
                                variant="flat"
                                label="Remote AS"
                                placeholder="0"
                                value={element.as}
                                onChange={(e) => handleChangeRouting(e, {
                                    ...machine.routing,
                                    bgp: {
                                        ...machine.routing.bgp,
                                        remote: machine.routing.bgp.remote.map((el, idx) => {
                                            if (idx === index){
                                                return {
                                                    ...el,
                                                    as: e.target.value
                                                }
                                            } else {
                                                return el
                                            }
                                        })
                                    }
                                })}
                            />
                            <Input
                                type="text"
                                variant="flat"
                                label="Description"
                                placeholder="0.0.0.0/0"
                                value={element.description}
                                onChange={(e) => handleChangeRouting(e, {
                                    ...machine.routing,
                                    bgp: {
                                        ...machine.routing.bgp,
                                        remote: machine.routing.bgp.remote.map((el, idx) => {
                                            if (idx === index){
                                                return {
                                                    ...el,
                                                    description: e.target.value
                                                }
                                            } else {
                                                return el
                                            }
                                        })
                                    }
                                })}
                            />
                        </div>
                    ))}
                </div>
                {machine.routingSoftware === "frr" &&
                    <Textarea
                        label="Directly after bgp config in frr.conf"
                        labelPlacement="outside"
                        value={machine.routing.bgp.free}
                        onValueChange={(value) => handleChangeRouting(value, {
                            ...machine.routing,
                            bgp: {
                                ...machine.routing.bgp,
                                free: value
                            }
                        })}
                    />
                || machine.routingSoftware === "quagga" &&
                    <Textarea
                        label="Directly in bgpfd.conf"
                        labelPlacement="outside"
                        value={machine.routing.bgp.free}
                        onValueChange={(value) => handleChangeRouting(value, {
                            ...machine.routing,
                            bgp: {
                                ...machine.routing.bgp,
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
