/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable no-else-return */
/* eslint-disable react/prop-types */
/* eslint-disable react/function-component-definition */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import {Select, SelectItem} from "@nextui-org/select";
import { Checkbox, CheckboxGroup, Textarea } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { Input } from "@nextui-org/react";
import { PlusSymbol } from "../../../Symbols/PlusSymbol";
import { MinusSymbol } from "../../../Symbols/MinusSymbol";
import { RIP } from "./Protocols/RIP";
import { OSPF } from "./Protocols/OSPF";
import { BGP } from "./Protocols/BGP";

export const RouterFunctions = ({machine, machines, setMachines}) => {
    function handleChange(value, data){
        setMachines(() => (
            machines.map(m => {
                if (m.id === machine.id){
                    return data
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
        <div className="grid gap-2">
            <Select
                aria-label="Routing Software"
                label="Routing Software"
                size="sm"
                defaultSelectedKeys={[machine.routingSoftware]}
                onChange={(e) => handleChange(e, {
                    ...machine,
                    routingSoftware: e.target.value
                })}
            >
                <SelectItem key="frr">
                    FRR
                </SelectItem>
                <SelectItem key="quagga">
                    Quagga
                </SelectItem>
            </Select>
            <label htmlFor="routing-protocols">Routing Protocols</label>
            <Checkbox
                isSelected={machine.routing.rip.en}
                onValueChange={(value) => handleChangeRouting(value, {
                ...machine.routing,
                rip: {
                    ...machine.routing.rip,
                    en: value
                }
            })} value="rip">RIP</Checkbox>
            <RIP machine={machine}
                machines={machines}
                setMachines={setMachines}/>
            <Checkbox
                isSelected={machine.routing.ospf.en}
                onValueChange={(value) => handleChangeRouting(value, {
                ...machine.routing,
                ospf: {
                    ...machine.routing.ospf,
                    en: value
                }
            })}>OSPF</Checkbox>
            <OSPF machine={machine}
                machines={machines}
                setMachines={setMachines}/>
            <Checkbox
                isSelected={machine.routing.bgp.en}
                onValueChange={(value) => handleChangeRouting(value, {
                ...machine.routing,
                bgp: {
                    ...machine.routing.bgp,
                    en: value
                }
            })}>BGP</Checkbox>
            <BGP machine={machine}
                machines={machines}
                setMachines={setMachines}/>
            <div>
            {machine.routingSoftware === "frr" &&
                <Textarea
                label="Directly in frr.conf"
                labelPlacement="outside"
                value={machine.routing.frr.free}
                onValueChange={(value) => handleChangeRouting(value, {
                    ...machine.routing,
                    frr: {
                        ...machine.routing.frr,
                        free: value
                    }
                })}
            />
            }
            </div>
        </div>
    )
}
