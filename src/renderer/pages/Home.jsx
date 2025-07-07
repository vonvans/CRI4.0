/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable prettier/prettier */
import { Textarea } from "@nextui-org/react";
import { useRef, useState } from "react";
import { LabInfo } from "../components/LabInfo";
import { Machines } from "../components/Machines/Machines.jsx"
import { generateScript } from "../scripts/make";
import { labInfoModel, backboneModel } from '../models/model.js';
import { Download } from "../components/Download";
import { Configuration } from "../components/Configuration";
import { Mock } from "../components/Mock/Mock";

function Home() {
    const [labInfo, setLabInfo] = useState(() => {
        const labInfo = localStorage.getItem("labInfo");
        return labInfo ? JSON.parse(labInfo) : labInfoModel;
    });

    const [machines, setMachines] = useState(() => {
        const savedMachines = localStorage.getItem("machines");
        const newMachine = [{id: crypto.randomUUID(), ...backboneModel}]
        if (savedMachines == null){
          localStorage.setItem("machines", JSON.stringify(newMachine));
        }
        return savedMachines ? JSON.parse(savedMachines) : [newMachine];
    });

    const componentRefs = useRef([]);

    return(
        <div className="min-h-[calc(100vh-4rem)] grid grid-cols-6">
            <div className="col-span-5 grid">
                <div className="p-4 px-2">
                    <LabInfo labInfo={labInfo} setLabInfo={setLabInfo}/>
                </div>
                <div className="grid p-4 gap-2">
                    <div>
                        <Machines machines={machines} setMachines={setMachines} componentRefs={componentRefs} />
                    </div>
                    <div>
                    <Textarea
                        label="Bash file preview:"
                        labelPlacement="outside"
                        minRows={6}
                        maxRows={8}
                        readOnly
                        value={machines && labInfo && generateScript(machines, labInfo)}
                    />
                    </div>
                </div>
            </div>
            <div className="grid gap-2 p-4">
                <div className="grid max-h-screen">
                    <div>
                        <Mock machines={machines} componentRefs={componentRefs} />
                        <Download machines={machines} labInfo={labInfo} />
                        <Configuration machines={machines} labInfo={labInfo} setMachines={setMachines} setLabInfo={setLabInfo}/>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
