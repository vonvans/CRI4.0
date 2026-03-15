/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable prettier/prettier */
import { v4 as uuidv4 } from 'uuid';
import { Textarea } from "@nextui-org/react";
import { useRef, useState } from "react";
import { LabInfo } from "../components/LabInfo";
import { Machines } from "../components/Machines/Machines.jsx"
import { generateScript } from "../scripts/make";
import { labInfoModel, backboneModel } from '../models/model.js';

import { Mock } from "../components/Mock/Mock";
import { ProjectManager } from '../components/ProjectManager.jsx';

function Home() {
    const [labInfo, setLabInfo] = useState(() => {
        const labInfo = localStorage.getItem("labInfo");
        return labInfo ? JSON.parse(labInfo) : labInfoModel;
    });

    const [machines, setMachines] = useState(() => {
        const savedMachines = localStorage.getItem("machines");
        const newMachine = [{ id: uuidv4(), ...backboneModel }]
        if (savedMachines == null) {
            localStorage.setItem("machines", JSON.stringify(newMachine));
        }

        const loadedMachines = savedMachines ? JSON.parse(savedMachines) : newMachine;

        // Sanitize loaded machines
        if (Array.isArray(loadedMachines)) {
            return loadedMachines.map(m => ({
                ...backboneModel, // Default values
                ...m,            // Overwritten by saved values
                id: m.id || uuidv4(),
                interfaces: {    // Deep merge for interfaces to ensure safety
                    ...backboneModel.interfaces,
                    ...(m.interfaces || {})
                },
                routing: {       // Deep merge for routing
                    ...backboneModel.routing,
                    ...(m.routing || {})
                }
            }));
        }

        return loadedMachines;
    });

    const componentRefs = useRef([]);

    return (
        <div className="min-h-[calc(100vh-4rem)] grid grid-cols-6">
            <div className="col-span-5 grid">
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
                <div className="grid max-h-screen content-start gap-4">
                    <ProjectManager machines={machines} labInfo={labInfo} setMachines={setMachines} setLabInfo={setLabInfo} />
                    <div>
                        <Mock machines={machines} componentRefs={componentRefs} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
