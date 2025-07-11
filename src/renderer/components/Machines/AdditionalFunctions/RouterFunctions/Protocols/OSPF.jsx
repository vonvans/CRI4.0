/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable no-else-return */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import {Select, SelectItem} from "@nextui-org/select";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Checkbox, CheckboxGroup, Divider, Textarea } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { Input } from "@nextui-org/react";
import { PlusSymbol } from "../../../../Symbols/PlusSymbol";
import { MinusSymbol } from "../../../../Symbols/MinusSymbol";

export function OSPF({machine, machines, setMachines}) {
    function addNetwork(e, data){
        setMachines(() => (
            machines.map(m => {
                if (m.id === machine.id){
                    return {
                        ...m,
                        routing: {
                            ...machine.routing,
                            ospf: data
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
                            ospf: data
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
            {machine.routing.ospf.en &&
            <div className="grid content-start gap-2">
                <div className="grid gap-2">
                    <div className="grid grid-cols-2 grid-rows-1 gap-2">
                        <Button onClick={(e) => addNetwork(e, {
                                ...machine.routing.ospf,
                                network: [...machine.routing.ospf.network, ""],
                                area: [...machine.routing.ospf.area, ""],
                                stub: [...machine.routing.ospf.stub, false]
                            })} aria-label="Add Gateway" size="sm" color="success">
                                <PlusSymbol fill="white" size={22} />
                        </Button>
                        <Button isDisabled={machine.routing.ospf.network.length <= 1} onClick={(e) => removeNetwork(e, {
                                ...machine.routing.ospf,
                                network: machine.routing.ospf.network.slice(0, machine.routing.ospf.network.length - 1),
                                area: machine.routing.ospf.area.slice(0, machine.routing.ospf.area.length - 1),
                                stub: machine.routing.ospf.stub.slice(0, machine.routing.ospf.stub.length - 1)
                            })} aria-label="Remove Gateway" size="sm" color="danger">
                                <MinusSymbol fill="white" size={22} />
                        </Button>
                    </div>
                    <div className="grid gap-2">
                        {machine.routing.ospf.network.map((n, index) => (
                            <Input
                                type="text"
                                variant="flat"
                                label="Network"
                                placeholder="0.0.0.0/0"
                                value={n}
                                onChange={(e) => handleChangeRouting(e, {
                                    ...machine.routing,
                                    ospf: {
                                        ...machine.routing.ospf,
                                        network: machine.routing.ospf.network.map((el, idx) => {
                                            if (idx === index){
                                                return e.target.value
                                            } else {
                                                return el
                                            }
                                        })
                                    }
                                })}
                            />
                        )) && machine.routing.ospf.area.map((n, index) => (
                            <div className="grid gap-2">
                                <Input
                                    type="text"
                                    variant="flat"
                                    label="Area"
                                    placeholder="0.0.0.0/0"
                                    value={n}
                                    onChange={(e) => handleChangeRouting(e, {
                                        ...machine.routing,
                                        ospf: {
                                            ...machine.routing.ospf,
                                            area: machine.routing.ospf.area.map((el, idx) => {
                                                if (idx === index){
                                                    return e.target.value
                                                } else {
                                                    return el
                                                }
                                            })
                                        }
                                    })}
                                />
                                <Checkbox
                                    isSelected={machine.routing.ospf.stub[index]}
                                    onValueChange={(value) => handleChangeRouting(value, {
                                        ...machine.routing,
                                        ospf: {
                                            ...machine.routing.ospf,
                                            stub: machine.routing.ospf.stub.map((el, idx) => {
                                                if (idx === index){
                                                    return value
                                                } else {
                                                    return el
                                                }
                                            })
                                        }
                                    })}
                                >stub?</Checkbox>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid gap-2">
                    <Checkbox
                        isSelected={machine.routing.ospf.rip}
                        onValueChange={(value) => handleChangeRouting(value, {
                            ...machine.routing,
                            ospf: {
                                ...machine.routing.ospf,
                                rip: value
                            }
                        })}
                    >Redistribute RIP</Checkbox>
                    <Checkbox
                        isSelected={machine.routing.ospf.bpg}
                        onValueChange={(value) => handleChangeRouting(value, {
                            ...machine.routing,
                            ospf: {
                                ...machine.routing.ospf,
                                bpg: value
                            }
                        })}
                    >Redistribute BGP</Checkbox>
                    <Checkbox
                        isSelected={machine.routing.ospf.connected}
                        onValueChange={(value) => handleChangeRouting(value, {
                            ...machine.routing,
                            ospf: {
                                ...machine.routing.ospf,
                                connected: value
                            }
                        })}
                    >Redistribute connected</Checkbox>
                </div>
                <div className="grid gap-2">
                    <label htmlFor="cost">Cost</label>
                    <div className="grid gap-2">
                        {machine.interfaces.if.map((i, index) =>
                            <div className="grid gap-2" key={index}>
                                <Input
                                    type="text"
                                    variant="flat"
                                    placeholder="0"
                                    value={machine.routing.ospf.if[i.eth.number].cost}
                                    onChange={(e) => handleChangeRouting(e, {
                                        ...machine.routing,
                                        ospf: {
                                            ...machine.routing.ospf,
                                            if: machine.routing.ospf.if.map((el, idx) => {
                                                if (idx === i.eth.number){
                                                    return {
                                                        ...el,
                                                        cost: e.target.value
                                                    }
                                                } else {
                                                    return el
                                                }
                                            })
                                        }
                                    })}
                                />
                                <Select
                                    aria-label="Routing Software"
                                    label="Routing Software"
                                    size="sm"
                                    defaultSelectedKeys={machine.routing.ospf.if[i.eth.number].interface}
                                    onChange={(e) => handleChangeRouting(e, {
                                        ...machine.routing,
                                        ospf: {
                                            ...machine.routing.ospf,
                                            if: machine.routing.ospf.if.map((el, idx) => {
                                                if (idx === i.eth.number){
                                                    return {
                                                        ...el,
                                                        interface: e.target.value
                                                    }
                                                } else {
                                                    return el
                                                }
                                            })
                                        }
                                    })}
                                >
                                    {machine.interfaces.if.map(ii =>
                                        <SelectItem textValue={`eth${ii.eth.number}`} key={ii.eth.number}>
                                            eth{ii.eth.number}
                                        </SelectItem>
                                    )}
                                </Select>
                            </div>
                        )}
                    </div>
                </div>
                {machine.routingSoftware === "frr" &&
                    <Textarea
                        label="Directly after ospf config in frr.conf"
                        labelPlacement="outside"
                        value={machine.routing.ospf.free}
                        onValueChange={(value) => handleChangeRouting(value, {
                            ...machine.routing,
                            ospf: {
                                ...machine.routing.ospf,
                                free: value
                            }
                        })}
                    />
                || machine.routingSoftware === "quagga" &&
                    <Textarea
                        label="Directly in ospfd.conf"
                        labelPlacement="outside"
                        value={machine.routing.ospf.free}
                        onValueChange={(value) => handleChangeRouting(value, {
                            ...machine.routing,
                            ospf: {
                                ...machine.routing.ospf,
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
