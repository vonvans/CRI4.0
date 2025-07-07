/* eslint-disable react/jsx-no-bind */
/* eslint-disable no-else-return */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
// eslint-disable-next-line prettier/prettier
import {Checkbox} from "@nextui-org/checkbox";
import { Input } from "@nextui-org/react";

export function WebServerFunctions({machine, machines, setMachines}) {
    function handleChange(value){
        setMachines(() => (
            machines.map(m => {
                if (m.id === machine.id){
                    return{
                        ...m,
                        ws: {
                            ...m.ws,
                            userdir: value
                        }
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
                isSelected={machine.ws.userdir}
                onValueChange={handleChange}
            >Enable userdir module?</Checkbox>
        </div>
    )
}
