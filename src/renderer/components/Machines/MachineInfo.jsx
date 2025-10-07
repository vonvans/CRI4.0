/* eslint-disable no-else-return */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { useState, useEffect } from "react";
import { RadioGroup, Radio } from "@nextui-org/radio";
import { Input } from "@nextui-org/input";
import { Switch } from "@nextui-org/switch";

export function MachineInfo({id, machine, machines, setMachines}) {
    function handleChange(value, data){
        setMachines(() => (
            machines.map(m => {
                if (m.id === machine.id){
                    return data
                } else {
                    return m
                }
            })
        ));
    }

    return (
        <div className="h-full">
            <div className="grid content-start gap-2">
                <div>
                    <Input
                        type="text"
                        variant="underlined"
                        placeholder={`pc${id}`}
                        value={machine.name}
                        onValueChange={(value) => handleChange(value, {
                            ...machine,
                            name: value.toLocaleLowerCase()
                        })}
                    />
                    <div className="mt-2">
                        <Switch
                            isSelected={!!machine.bridged}
                            onValueChange={(val) =>
                                setMachines(ms => ms.map(m =>
                                    m.id === machine.id ? { ...m, bridged: val } : m
                                ))
                            }
                        >
                            Online (bridged)
                        </Switch>
                    </div>
                </div>
                <div className="row-span-7">
                    <RadioGroup
                        label={<span className="text-primary">Type</span>}
                        color="primary"
                        defaultValue={machine.type}
                        onValueChange={(value) => handleChange(value, {
                            ...machine,
                            type: value
                        })}
                    >
                        <Radio isDisabled={machines.filter(m => m.type === "attacker").length > 0} value="attacker">Attacker</Radio>
                        <Radio value="terminal">Terminal</Radio>
                        <Radio value="router">Router</Radio>
                        <Radio value="ns">Name Server</Radio>
                        <Radio value="ws">Web Server</Radio>
                        <Radio value="ngfw">NGFW Appliance</Radio>
                        {machines.filter(m => m.type === "controller" && m.id !== machine.id).length === 1 && (
                            <Radio value="switch">Open vSwitch</Radio>
                        ) || (
                            <Radio value="controller">OpenFlow Ryu Controller</Radio>
                        )
                        }
                        <Radio value="other">Other</Radio>
                    </RadioGroup>
                    {machine.type === "other" && (
                        <Input
                            type="text"
                            label="Image Name"
                            variant="underlined"
                            placeholder="example p4"
                            value={machine.other.image}
                            onValueChange={(value) => handleChange(value, {
                                ...machine,
                                other: {
                                    ...machine.other,
                                    image: value
                                }
                            })}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
