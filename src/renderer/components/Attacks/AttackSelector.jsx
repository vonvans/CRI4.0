/* eslint-disable react/no-array-index-key */
/* eslint-disable react/self-closing-comp */
/* eslint-disable promise/always-return */
/* eslint-disable promise/catch-or-return */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { Card, CardBody, RadioGroup, Radio, Input, Button } from "@nextui-org/react";
import { useState, useContext } from "react";
import { FaWrench } from "react-icons/fa6";
import { LogContext } from "../../contexts/LogContext";

function AttackSelector({type, attacker, attacks, selectedImage, setSelectedImage, isLoading, handleRefresh}) {

    function BuildButton({attack, handleRefresh}) {
        const [isBuilding, setIsBuilding] = useState(false);
        const {logs, setLogs} = useContext(LogContext);

        const buildImage = (e, attack) => {
            setIsBuilding(true);
            window.electron.ipcRenderer.invoke('docker-build', `${attack.category}-${attack.name}`).then((output) => {
                console.log(output);
                setLogs([...logs, `${attack.category}-${attack.name} arg:  Built image: ${attack.image}\n${output.join("\n")}\n`]);
                setIsBuilding(false);
                handleRefresh();
            });
        }

        return (
            <Button isLoading={isBuilding} onClick={(e) => buildImage(e, attack)} isDisabled={attack.isImage || isBuilding} className="bg-secondary col-span-1" endContent={!isBuilding && <FaWrench />}></Button>
        )
    }

    return (
        <Card>
            <CardBody>
                <div className="grid gap-2">
                    <RadioGroup label="Select attack type" defaultValue={selectedImage}>
                    { attacks.map((attack, index) => (
                        attack.category === type && (
                            <div key={index} className="grid gap-2 grid-cols-2 items-center">
                                <div>
                                    <Radio isDisabled={!attack.isImage || attacker.attackLoaded} value={`icr/${attack.category}-${attack.name}`} onClick={() => setSelectedImage(attack.image)}>{attack.displayName}</Radio>
                                </div>
                                <div className="grid gap-2 grid-cols-5">
                                    <Input className={`pl-2 col-span-${!attack.isImage ? "4" : "5"}`} type="text" value={isLoading ? "Loading images..." : attack.image} placeholder="Image not found" disabled/>
                                    {!attack.isImage && (
                                        <BuildButton attack={attack} handleRefresh={handleRefresh} />
                                    )}
                                </div>
                            </div>
                        )
                    ))}
                    </RadioGroup>
                </div>
            </CardBody>
        </Card>
    )
}

export default AttackSelector;
