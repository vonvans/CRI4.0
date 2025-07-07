/* eslint-disable react/jsx-no-target-blank */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable no-else-return */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import {Checkbox} from "@nextui-org/checkbox";
import { Input } from "@nextui-org/react";

export function OpenFlowRyu({machine, machines, setMachines}) {
    function handleChange(value, data){
        setMachines(() => (
            machines.map(m => {
                if (m.id === machine.id){
                    return{
                        ...m,
                        ryu: data
                    }
                } else {
                    return m
                }
            })
        ))
    }

    return (
        <div>
            <label htmlFor="ryu">Ryu startup applications</label>
            <Checkbox
                isSelected={machine.ryu.stp}
                onValueChange={(value) => handleChange(value, {
                    ...machine.ryu,
                    stp: value
                })}
            >Spanning tree protocol</Checkbox>
            <Checkbox
                isSelected={machine.ryu.rest}
                onValueChange={(value) => handleChange(value, {
                    ...machine.ryu,
                    rest: value
                })}
            >REST Controller</Checkbox>
            <Checkbox
                isSelected={machine.ryu.topology}
                onValueChange={(value) => handleChange(value, {
                    ...machine.ryu,
                    topology: value
                })}
            >REST topology</Checkbox>
            <Input
                label="Other"
                description={
                    <a href="https://github.com/osrg/ryu/tree/master/ryu/app" target="_blank">
                        default apps
                    </a>
                }
                type="text"
                variant="underlined"
                placeholder="app1 app2"
                value={machine.ryu.custom}
                onValueChange={(value) => handleChange(value, {
                    ...machine.ryu,
                    custom: value
                })}
            />
        </div>
    )
}
