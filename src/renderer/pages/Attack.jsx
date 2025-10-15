/* eslint-disable react/no-unknown-property */
/* eslint-disable eqeqeq */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import { useState, useEffect } from "react";
import { Tab, Tabs } from "@nextui-org/react";
import { Card, CardBody } from "@nextui-org/react";
import { Checkbox, CheckboxGroup } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import Stepper from "../components/Stepper";
import { XSymbol } from "../components/Symbols/XSymbol";
import useAttacks from "../hooks/useAttacks";
import { attacksModel } from "../models/model";
import DOS from "../components/Attacks/DOS";
import PING from "../components/Attacks/temp";
import Reconnaissance from "../components/Attacks/Reconnaissance"
import MITM from "../components/Attacks/MITM"
import Injection from "../components/Attacks/Injection"
import Sniffing from "../components/Attacks/Sniffing";

function Attack() {
    const [machines, setMachines] = useState(() => {
        const savedMachines = localStorage.getItem("machines");
        return savedMachines ? JSON.parse(savedMachines) : [];
    });
    useEffect(() => {
        localStorage.setItem("machines", JSON.stringify(machines));
      }, [machines]);
    const [stepStatus, setStepStatus] = useState(true)

    const attacker = machines.filter((m) => m.type == "attacker")[0]

    const [refresh, setRefresh] = useState(false);
    const [attacks, isLoading] = useAttacks(refresh);

    const handleRefresh = () => {
        setRefresh(prev => !prev);
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] grid pb-24">
            {stepStatus && (
                <div className="grid place-items-center">
                    <Stepper machines={machines} onComplete={(val) => setStepStatus(val)} />
                </div>
            ) || (
                <div className="p-4">
                    <Card className="mb-2 border-l-2 border-warning bg-warning/10 px-4 py-1 w-full">
                        <CardBody className="p-1 text-warning text-xs">
                            ⚠️ Be sure to check user permissions to build Docker images. If the build button is not working, try running:
                             <code className="font-mono">sudo usermod -aG docker $USER && newgrp docker</code>
                        </CardBody>
                    </Card>
                    <div className="h-full">
                        <Tabs isVertical classNames={{tabList: "h-full", tabWrapper: "h-full bg-red-700"}} aria-label="Category" className="px-1 col-span-1">
                            <Tab title="Reconnaissance" className="grid gap-2 w-full">
                                <Reconnaissance attacker={attacker} attacks={attacks} isLoading={isLoading} machines={machines} setMachines={setMachines} handleRefresh={handleRefresh}/>
                            </Tab>
                            <Tab title="Man-in-the-Middle" className="grid gap-2 w-full">
                                <MITM attacker={attacker} attacks={attacks} isLoading={isLoading} machines={machines} setMachines={setMachines} handleRefresh={handleRefresh}/>
                            </Tab>
                            <Tab title="Denial of Service" className="grid gap-2 w-full">
                                <DOS attacker={attacker} attacks={attacks} isLoading={isLoading} machines={machines} setMachines={setMachines} handleRefresh={handleRefresh}/>
                            </Tab>
                            <Tab title="Injection" className="grid gap-2 w-full">
                                <Injection attacker={attacker} attacks={attacks} isLoading={isLoading} machines={machines} setMachines={setMachines} handleRefresh={handleRefresh}/>
                            </Tab>
                            <Tab title="Sniffing" className="grid gap-2 w-full">
                                <Sniffing attacker={attacker} attacks={attacks} isLoading={isLoading} machines={machines} setMachines={setMachines} handleRefresh={handleRefresh}/>
                            </Tab>
                            <Tab title="Other" className="grid gap-2 w-full">
                                <Card className="h-full">
                                    <CardBody className="grid place-items-center">
                                        <h1>Not Implemented Yet</h1>
                                    </CardBody>
                                </Card>
                            </Tab>
                        </Tabs>
                    </div>
                </div>
            )}
            <style jsx="true">{`
                [data-slot="tabWrapper"] {
                    height: 100%;
                }
            `}</style>
        </div>
    )
}

export default Attack;
