/* eslint-disable no-unneeded-ternary */
/* eslint-disable no-else-return */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import {Select, SelectItem} from "@nextui-org/select";

export function TerminalFunctions({machine, machines, setMachines}) {
    function handleChange(value){
        setMachines(() => (
            machines.map(m => {
                if (m.id === machine.id){
                    return {
                        ...m,
                        pc: {
                            ...m.pc,
                            dns: value
                        }
                    }
                } else {
                    return m
                }
            })
        ))
    }

    return (
        <Select
            aria-label="Reference DNS"
            label="Reference DNS"
            description="resolv.conf nameserver"
            size="sm"
            defaultSelectedKeys="-"
            onChange={(e) => handleChange(e.target.value)}
        >
            <SelectItem key="-">-</SelectItem>
            {machines.filter(m =>
                m.type === "nameserver"
            ).map(m =>
                m.interfaces.if.map(i =>
                    <SelectItem textValue={i.ip.split('/')[0]} isReadOnly={i.ip === "" ? true : false} description={m.name} key={i.ip.split('/')[0]}>
                        {i.ip.split('/')[0]}
                    </SelectItem>
                ))
            }
        </Select>
    )
}
