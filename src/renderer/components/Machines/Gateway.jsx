/* eslint-disable react/no-array-index-key */
/* eslint-disable no-unneeded-ternary */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable no-else-return */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect } from "react";
import {RadioGroup, Radio} from "@nextui-org/radio";
import {Input} from "@nextui-org/input";
import {Select, SelectItem} from "@nextui-org/select";
import {Textarea} from "@nextui-org/input";
import {Divider} from "@nextui-org/divider";
import {Button} from "@nextui-org/button";
import {PlusSymbol} from '../Symbols/PlusSymbol';
import {MinusSymbol} from '../Symbols/MinusSymbol';

export function Gateway({machine, machines, setMachines}) {
    function addGateway(){
        setMachines((machines) => (
            machines.map(m => {
                if (m.id === machine.id){
                    return {
                        ...m,
                        gateways:{
                            ...m.gateways,
                            gw: [
                                ...m.gateways.gw,
                                {
                                    route: "",
                                    if: 0
                                }
                            ],
                            counter: m.gateways.counter + 1
                        }
                    }
                } else {
                    return m
                }
            })
        ))
    }

    function removeGateway(){
        setMachines((machines) => (
            machines.map(m => {
                if (m.id === machine.id){
                    return {
                        ...m,
                        gateways: {
                            ...m.gateways,
                            gw: m.gateways.gw.slice(0, m.gateways.gw.length - 1),
                            counter: m.gateways.counter - 1
                        }
                    }
                } else {
                    return m
                }
            })
        ))
    }

    function handleChange(e, index, data){
        setMachines((machines) => (
            machines.map(m => {
                if (m.id === machine.id){
                    return {
                        ...m,
                        gateways: {
                            ...m.gateways,
                            gw: m.gateways.gw.map((gw, idx) => {
                                if (idx === index){
                                    return data
                                } else {
                                    return gw
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

    return (
        <div className="h-full">
            {machine.type !== "controller" && machine.type !== "switch" && (
                 <div className="grid content-start gap-2">
                    <div>
                        <div className="grid grid-cols-2 grid-rows-1 gap-2">
                        <Button onClick={addGateway} aria-label="Add Gateway" size="sm" color="success">
                                <PlusSymbol fill="white" size={22} />
                        </Button>
                        <Button isDisabled={machine.gateways.counter > 1 ? false : true} onClick={removeGateway} aria-label="Remove Gateway" size="sm" color="danger">
                                <MinusSymbol fill="white" size={22} />
                        </Button>
                        </div>
                    </div>
                    {machines.find((m) => m.id === machine.id)
                    .gateways.gw.map((gw, index) => (
                        <div className="grid gap-2" key={index}>
                            <Input
                                type="text"
                                variant="flat"
                                label="Route"
                                description="(empty for default gw)"
                                placeholder="0.0.0.0/0"
                                value={gw.route || ""}
                                onChange={(e) => handleChange(e, index, {
                                    ...gw,
                                    route: e.target.value
                                })}
                            />
                            <Input
                                type="text"
                                variant="flat"
                                label="Gateway"
                                description="empty to generate nothing"
                                placeholder="0.0.0.0/0"
                                value={gw.gw || ""}
                                onChange={(e) => handleChange(e, index, {
                                    ...gw,
                                    gw: e.target.value
                                })}
                            />
                            <Select
                                aria-label="Select Interface"
                                label="Interface"
                                size="sm"
                                defaultSelectedKeys={gw.if || ""}
                                onChange={(e) => handleChange(e, index, {
                                    ...gw,
                                    if: e.target.value
                                })}
                            >
                                {machine.interfaces.if.map(i =>
                                    <SelectItem textValue={`eth${i.eth.number}`} key={i.eth.number}>
                                        eth{i.eth.number}
                                    </SelectItem>
                                )}
                            </Select>
                            <Divider />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
