/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { CheckboxGroup, Checkbox } from "@nextui-org/react";
import { Input } from "@nextui-org/input";

export function ScadaFunctions({ machine, machines, setMachines }) {
    // Find all industrial machines on the same subnet (same eth0 domain)
    // Industrial types: engine, fan, temperature_sensor, rejector, scada, apg, laser, conveyor, plc
    const industrialTypes = [
        "engine",
        "fan",
        "temperature_sensor",
        "rejector",
        "scada",
        "apg",
        "laser",
        "conveyor",
        "plc"
    ];

    const machineEth0Domain = machine.interfaces?.if?.[0]?.eth?.domain;

    const availableMachines = machines.filter((m) => {
        // Must be an industrial type
        if (!industrialTypes.includes(m.type)) return false;
        // Exclude self
        if (m.id === machine.id) return false;

        // Check if the machine is on the same eth0 domain (subnet)
        const mEth0Domain = m.interfaces?.if?.[0]?.eth?.domain;
        return mEth0Domain && mEth0Domain === machineEth0Domain;
    });

    const selectedMachines = machine.industrial?.monitored_machines || [];

    function handleSelectionChange(values) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    industrial: {
                        ...(m.industrial || {}),
                        monitored_machines: values
                    }
                };
            }
            return m;
        }));
    }

    return (
        <div>
            <div className="mb-2">
                <label className="text-sm font-semibold">Monitored Machines</label>
                <p className="text-xs text-text/50">
                    Select industrial machines in the same subnet (eth0)
                </p>
            </div>

            {availableMachines.length > 0 ? (
                <CheckboxGroup
                    color="primary"
                    value={selectedMachines}
                    onValueChange={handleSelectionChange}
                >
                    {availableMachines.map((m) => (
                        <Checkbox key={m.id} value={m.id}>
                            {m.name} ({m.interfaces?.if?.[0]?.ip || "no IP"})
                        </Checkbox>
                    ))}
                </CheckboxGroup>
            ) : (
                <div className="text-sm text-text/50 p-2 bg-default-100 rounded">
                    No industrial machines available on the same subnet (eth0).
                    Add industrial machines and connect them to the same collision domain.
                </div>
            )}

            <div className="mt-4">
                <label className="text-sm font-semibold">Upload Project (.db)</label>
                <div className="mt-1">
                    <input
                        type="file"
                        accept=".db"
                        className="block w-full text-sm text-slate-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-md file:border-0
                            file:text-sm file:font-semibold
                            file:bg-primary-50 file:text-primary-700
                            hover:file:bg-primary-100"
                        onClick={() => console.log("SCADA Input clicked")}
                        onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;

                            const reader = new FileReader();
                            reader.onload = () => {
                                const base64Content = reader.result;
                                console.log("SCADA File loaded:", file.name);
                                setMachines(machines.map(m => {
                                    if (m.id === machine.id) {
                                        return {
                                            ...m,
                                            industrial: {
                                                ...(m.industrial || {}),
                                                scadaProjectName: file.name,
                                                scadaProjectContent: base64Content
                                            }
                                        };
                                    }
                                    return m;
                                }));
                                alert(`Project "${file.name}" selected. It will be uploaded when you start the simulation.`);
                            };
                            reader.readAsDataURL(file);
                        }}
                    />
                    {machine.industrial?.scadaProjectName && (
                        <div className="mt-1 text-xs text-success">
                            Selected: {machine.industrial.scadaProjectName}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
