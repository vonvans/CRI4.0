/* eslint-disable react/no-unknown-property */
/* eslint-disable eqeqeq */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import { useState, useEffect, useMemo } from "react";
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
import AccessGain from "../components/Attacks/AccessGain";
import CustomAttacks from "../components/Attacks/CustomAttacks";

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

    const defaultTabFromCategory = (category) => {
        if (!category) return "Reconnaissance";
        switch (category.toLowerCase()) {
            case "reconnaissance": return "Reconnaissance";
            case "mitm": return "Man-in-the-Middle";
            case "dos":
            case "flood": return "Denial of Service";
            case "injection": return "Injection";
            case "access-gain": return "Access Gain";
            case "sniffing": return "Sniffing";
            case "ping": return "Denial of Service"; // Defaulting ping to dos because it doesn't have a tab
            default: return "Other";
        }
    };

    const initialActiveTab = useMemo(() => {
        if (!attacker || (!attacker.attackLoaded && !attacker.customAttackId)) return "Reconnaissance";
        if (attacker.customAttackId) return "Custom";
        let category = "Reconnaissance";

        // Find the attack in our model
        let activeAttack = attacksModel?.find(a => 
            a.image === attacker.attackImage || 
            a.name === attacker.attackImage || 
            a.displayName === attacker.attackImage
        );

        // Try to match the dynamically generated image name (more robustly)
        if (!activeAttack && attacker.attackImage.includes("icr/")) {
            activeAttack = attacksModel?.find(a => {
                const searchString = `icr/${a.category.toLowerCase()}-${a.name}`;
                return attacker.attackImage === searchString || attacker.attackImage.startsWith(`${searchString}:`);
            });
        }

        // Handle legacy crack-plc from localStorage or custom tags
        if (!activeAttack && attacker.attackImage === "icr/access-gain-crack-plc:latest") {
            category = "access-gain";
        } else if (activeAttack) {
            category = activeAttack.category;
        } else if (attacker.attackImage.includes("icr/")) {
            const rest = attacker.attackImage.split('icr/')[1] || "";
            // fallback if not found in model (tries to find if any category matches the prefix)
            const possibleCategories = ["reconnaissance", "mitm", "dos", "flood", "injection", "access-gain", "sniffing"];
            const foundCategory = possibleCategories.find(c => rest.startsWith(`${c}-`));
            category = foundCategory || rest.split('-')[0] || "Reconnaissance";
        }

        return defaultTabFromCategory(category);
    }, [attacker]);

    const [selectedTab, setSelectedTab] = useState(initialActiveTab);

    // If active tab changes via reload/state, keep it in sync
    useEffect(() => {
        if (initialActiveTab) setSelectedTab(initialActiveTab);
    }, [initialActiveTab]);

    return (
        <div className="min-h-[calc(100vh-4rem)] grid pb-24">
            {stepStatus && (
                <div className="grid place-items-center">
                    <Stepper machines={machines} onComplete={(val) => setStepStatus(val)} />
                </div>
            ) || (
                    <div className="p-4">
                        <div className="h-full">
                            <Tabs isVertical selectedKey={selectedTab} onSelectionChange={setSelectedTab} classNames={{ tabList: "h-full", tabWrapper: "h-full bg-red-700" }} aria-label="Category" className="px-1 col-span-1">
                                <Tab key="Reconnaissance" title="Reconnaissance" className="grid gap-2 w-full">
                                    <Reconnaissance attacker={attacker} attacks={attacks} isLoading={isLoading} machines={machines} setMachines={setMachines} handleRefresh={handleRefresh} />
                                </Tab>
                                <Tab key="Man-in-the-Middle" title="Man-in-the-Middle" className="grid gap-2 w-full">
                                    <MITM attacker={attacker} attacks={attacks} isLoading={isLoading} machines={machines} setMachines={setMachines} handleRefresh={handleRefresh} />
                                </Tab>
                                <Tab key="Denial of Service" title="Denial of Service" className="grid gap-2 w-full">
                                    <DOS attacker={attacker} attacks={attacks} isLoading={isLoading} machines={machines} setMachines={setMachines} handleRefresh={handleRefresh} />
                                </Tab>
                                <Tab key="Injection" title="Injection" className="grid gap-2 w-full">
                                    <Injection attacker={attacker} attacks={attacks} isLoading={isLoading} machines={machines} setMachines={setMachines} handleRefresh={handleRefresh} />
                                </Tab>
                                <Tab key="Sniffing" title="Sniffing" className="grid gap-2 w-full">
                                    <Sniffing attacker={attacker} attacks={attacks} isLoading={isLoading} machines={machines} setMachines={setMachines} handleRefresh={handleRefresh} />
                                </Tab>
                                <Tab key="Access Gain" title="Access Gain" className="grid gap-2 w-full">
                                    <AccessGain attacker={attacker} attacks={attacks} isLoading={isLoading} machines={machines} setMachines={setMachines} handleRefresh={handleRefresh} />
                                </Tab>
                                <Tab key="Other" title="Other" className="grid gap-2 w-full">
                                    <Card className="h-full">
                                        <CardBody className="grid place-items-center">
                                            <h1>Not Implemented Yet</h1>
                                        </CardBody>
                                    </Card>
                                </Tab>
                                <Tab key="Custom" title="Custom" className="grid gap-2 w-full">
                                    <CustomAttacks attacker={attacker} machines={machines} setMachines={setMachines} />
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
