/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Graph from "react-graph-vis";
import { makeGraph } from "../scripts/draw";
import { useState, useEffect } from "react";
import { Accordion, AccordionItem, Button, Card, CardBody } from "@nextui-org/react";
import { Checkbox, CheckboxGroup } from "@nextui-org/react";
import { Select, SelectItem } from "@nextui-org/react";
import { Slider } from "@nextui-org/react";
import TopologyGraph from "../components/TopologyGraph";
import { useContext } from "react";
import { NotificationContext } from "../contexts/NotificationContext";

function Topology() {
    const [machines, setMachines] = useState(() => {
        const savedMachines = localStorage.getItem("machines");
        return savedMachines ? JSON.parse(savedMachines) : [];
    });

    const { attackLoaded } = useContext(NotificationContext);

    return(
        <div className="grid min-h-[calc(100vh-4rem)] gap-2 p-4">
            <div className="grid h-[calc(100vh-10rem)] items-center">
                <div className="bg-white h-full rounded-xl">
                    {machines.every((m) => m.name === "") && (
                            <div className="grid place-items-center h-full">
                                <h1 className="text-background">No machines</h1>
                            </div>
                    ) || (
                            <div className="h-full">
                                <TopologyGraph machines={machines} />
                            </div>
                    )}
                </div>
            </div>
            <div className="grid items-start">
                <Button isDisabled={!attackLoaded} className={!attackLoaded ? "bg-success/50" : "bg-success"} >Simulate Attack</Button>
            </div>
                {/* <div className="">
                    <Accordion variant="splitted">
                        <AccordionItem key="1" aria-label="lab-info" title="Controls">
                            <span className="text-foreground text-large" data-open="true">Controls</span>
                            <div className="grid grid-cols-3">
                                <div className="grid gap-2 justify-items-center">
                                    <h1>Edges smoothness</h1>
                                    <Checkbox defaultSelected onValueChange={(value) => setSmoothEnabled({checked: value})}>Enabled</Checkbox>
                                    <Select
                                        label="Type"
                                        className="max-w-xs"
                                        defaultSelectedKeys={["dynamic"]}
                                        onChange={(e) => setSmoothEnabled({value: e.target.value})}
                                    >
                                        <SelectItem key="dynamic">Dynamic</SelectItem>
                                        <SelectItem key="continuous">Continuous</SelectItem>
                                        <SelectItem key="discrete">Discrete</SelectItem>
                                        <SelectItem key="diagonalCross">DiagonalCross</SelectItem>
                                        <SelectItem key="straightCross">StraightCross</SelectItem>
                                        <SelectItem key="horizontal">Horizontal</SelectItem>
                                        <SelectItem key="vertical">Vertical</SelectItem>
                                        <SelectItem key="curvedCW">CurvedCW</SelectItem>
                                        <SelectItem key="curvedCCW">CurvedCCW</SelectItem>
                                        <SelectItem key="cubicBezier">CubicBezier</SelectItem>
                                    </Select>
                                </div>
                                <div className="grid gap-2 justify-items-center">
                                    <h1>Physics</h1>
                                    <Checkbox defaultSelected onValueChange={(value) => setPhysicsEnabled({checked: value})}>Enabled</Checkbox>
                                    <Slider
                                        size="lg"
                                        step={100}
                                        color="foreground"
                                        label="Temperature"
                                        showSteps={true}
                                        maxValue={0}
                                        minValue={-30000}
                                        defaultValue={-1200}
                                        className="max-w-md"
                                    />
                                </div>
                                <div className="grid gap-2 justify-items-center">
                                    <h1>Miscellaneous</h1>
                                    <CheckboxGroup>
                                        <Checkbox value="ifNameAt" onValueChange={(value) => setIfNameAt({checked: value})}>Replace interface name with "@"</Checkbox>
                                        <Checkbox value="ifOspfCost" onValueChange={(value) => setIfOspfCost({checked: value})}>Show OSPF interface cost</Checkbox>
                                        <Checkbox value="routingLabel" onValueChange={(value) => setRoutingLabel({checked: value})}>Show OSPF/RIP/BGP label on router</Checkbox>
                                    </CheckboxGroup>
                                </div>
                            </div>
                        </AccordionItem>
                    </Accordion>
                </div> */}
        </div>
    );
}

export default Topology;
