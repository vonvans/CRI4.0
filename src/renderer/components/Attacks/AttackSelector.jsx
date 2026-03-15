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
import { api } from "../../api";

function AttackSelector({ type, attacker, attacks, selectedImage, setSelectedImage, isLoading, handleRefresh }) {

    function BuildButton({ attack, handleRefresh }) {
        const [isBuilding, setIsBuilding] = useState(false);
        const { logs, setLogs } = useContext(LogContext);

        const buildImage = (e, attack) => {
            setIsBuilding(true);
            api.buildDockerImage(`${attack.category}-${attack.name}`)
                .then((output) => {
                    // Backend now returns immediately with a "started" message.
                    // The actual build logs are streamed via SSE to LogContext.
                    console.log("Build started:", output);
                    setLogs(prev => [...prev, `${attack.category}-${attack.name}: Build initiated. Check logs for progress.\n`]);

                    // We don't turn off isBuilding immediately to prevent double-clicking, 
                    // but we also don't know when it finishes. 
                    // A simple timeout or just letting it finish 'loading' state now is fine 
                    // since the user can see log activity.
                    setTimeout(() => {
                        setIsBuilding(false);
                        // Refresh to check if it finished quickly, though likely user will need to refresh manually later
                        handleRefresh();
                    }, 2000);
                })
                .catch(err => {
                    console.error(err);
                    setLogs(prev => [...prev, `Error starting build: ${err.message}\n`]);
                    setIsBuilding(false);
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
                        {attacks.map((attack, index) => (
                            attack.category === type && (
                                <div key={index} className="grid gap-2 grid-cols-2 items-center">
                                    <div>
                                        <Radio isDisabled={!attack.isImage || attacker.attackLoaded} value={`icr/${attack.category}-${attack.name}`} onClick={() => setSelectedImage(attack.image)}>{attack.displayName}</Radio>
                                    </div>
                                    <div className="grid gap-2 grid-cols-5">
                                        <Input className={`pl-2 col-span-${!attack.isImage ? "4" : "5"}`} type="text" value={isLoading ? "Loading images..." : attack.image} placeholder="Image not found" disabled />
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
