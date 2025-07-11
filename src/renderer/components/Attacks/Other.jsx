/* eslint-disable no-else-return */
/* eslint-disable prefer-template */
/* eslint-disable object-shorthand */
/* eslint-disable react/prop-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import { Card, CardBody, Input } from "@nextui-org/react";
import { Radio, RadioGroup } from "@nextui-org/react";
import { CheckboxGroup, Checkbox } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { useState } from "react";
import { FaWrench } from "react-icons/fa6";
import { FaArrowRotateLeft } from "react-icons/fa6";
import { useContext } from "react";
import { NotificationContext } from "../../contexts/NotificationContext";
import { XSymbol } from "../Symbols/XSymbol";
import { LogContext } from "../../contexts/LogContext";
import MachineSelector from "./MachineSelector";
import AttackSelector from "./AttackSelector";

function Other({attacker, attacks, isLoading, machines, setMachines, handleRefresh}) {
    const [selectedImage, setSelectedImage] = useState(attacker.attackImage);
    const { attackLoaded, setAttackLoaded } = useContext(NotificationContext);
    const [targets, setTargets] = useState(attacker.targets);

    console.log(attacker.attackImage)

    const toggleAttack = (val) => {
        setMachines(machines.map((m) => {
            if (m.type === "attacker"){
                if (!attacker.attackLoaded){
                    setAttackLoaded(true)
                    return {
                        ...m,
                        targets: targets,
                        attackLoaded: true,
                        attackImage: val,
                        attackCommand: "sh ./script.sh " + targets.map((t) => t.interfaces.if.filter((i) =>
                            i.eth.domain === attacker.interfaces.if[0].eth.domain
                        ).map((i) => i.ip.split("/")[0])).join(" ")
                    }
                } else {
                    setAttackLoaded(false)
                    return {
                        ...m,
                        targets: [],
                        attackLoaded: false,
                        attackImage: "",
                        attackCommand: ""
                    }
                }
            } else {
                return m
            }
        }))
    }

    return (
        <div className="flex flex-col auto-rows-max gap-2">
            <div className="grid items-start">
                <Button isLoading={isLoading} className="bg-secondary" startContent={isLoading ? null : <FaArrowRotateLeft />} onClick={handleRefresh}>{isLoading ? "Refreshing images..." : "Refresh images"}</Button>
            </div>
            <div className="flex-grow">
                <div className="grid gap-2">
                    <MachineSelector machines={machines} setTargets={setTargets} attacker={attacker} />
                    <AttackSelector type="other" attacker={attacker} attacks={attacks} selectedImage={selectedImage} setSelectedImage={setSelectedImage} isLoading={isLoading} handleRefresh={handleRefresh}/>
                </div>
            </div>
            <div className="grid">
                <Button
                    isDisabled={selectedImage === ""}
                    className={attacker.attackLoaded ? "bg-primary" : "bg-success"}
                    startContent={attacker.attackLoaded && <XSymbol />}
                    onClick={() => toggleAttack(selectedImage)}
                >
                    {attacker.attackLoaded ? "Unload Attack" : "Load Attack"}
                </Button>
            </div>
        </div>
    )
}

export default Other;
