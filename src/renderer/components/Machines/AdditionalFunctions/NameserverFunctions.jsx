/* eslint-disable no-else-return */
/* eslint-disable import/prefer-default-export */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import {Checkbox} from "@nextui-org/checkbox";
import { Input } from "@nextui-org/react";

export function NameserverFunctions({machine, machines, setMachines}) {
    function handleChange(value, data){
        setMachines(() => (
            machines.map(m => {
                if (m.id === machine.id){
                    return{
                        ...m,
                        ns: data
                    }
                } else {
                    return m
                }
            })
        ))
    }

    return (
        <div>
            <Checkbox
                isSelected={machine.ns.authority}
                onValueChange={(value) => handleChange(value, {
                        ...machine.ns,
                        authority: value
                })}
            >I am a Nameserver Authority</Checkbox>
            <Input
                label="Zone"
                description="root is ."
                type="text"
                variant="underlined"
                placeholder=".com."
                value={machine.ns.name}
                onValueChange={(value) => handleChange(value, {
                        ...machine.ns,
                        name: value
                })}
            />
            <Checkbox
                isSelected={machine.ns.recursion}
                onValueChange={(value) => handleChange(value, {
                        ...machine.ns,
                        recursion: value
                })}
            >Enable recursive</Checkbox>
        </div>
    )
}
