import { CheckboxGroup, Checkbox, Tabs, Tab } from "@nextui-org/react";
import { Input } from "@nextui-org/input";
import { MdSearch, MdFileUpload } from "react-icons/md";
import { isHolderDevice } from "../../../utils/deviceAutoCreate";

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
        "plc",
        "device",
        "netproxy"
    ];

    const machineEth0Domain = machine.interfaces?.if?.[0]?.eth?.domain;

    const availableMachines = machines.filter((m) => {
        // Must be an industrial type
        if (!industrialTypes.includes(m.type)) return false;
        // Exclude self
        if (m.id === machine.id) return false;
        // Config holders are not deployed, so they cannot be monitored.
        if (isHolderDevice(m)) return false;

        // Check if the machine is on the same eth0 domain (subnet)
        const mEth0Domain = m.interfaces?.if?.[0]?.eth?.domain;
        return mEth0Domain && mEth0Domain === machineEth0Domain;
    });

    const selectedMachines = machine.industrial?.monitored_machines || [];
    const scadaMode = machine.industrial?.scadaMode || (machine.industrial?.scadaProjectName ? "project" : "discovery");

    function handleSelectionChange(values) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    industrial: {
                        ...(m.industrial || {}),
                        monitored_machines: values,
                        scadaMode: "discovery",
                        // Clear project if we are in discovery mode
                        scadaProjectName: undefined,
                        scadaProjectContent: undefined
                    }
                };
            }
            return m;
        }));
    }

    function handleModeChange(key) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                const newIndustrial = { ...(m.industrial || {}), scadaMode: key };
                if (key === "discovery") {
                    delete newIndustrial.scadaProjectName;
                    delete newIndustrial.scadaProjectContent;
                } else {
                    newIndustrial.monitored_machines = [];
                }
                return { ...m, industrial: newIndustrial };
            }
            return m;
        }));
    }

    return (
        <div className="flex flex-col gap-4">
            <Tabs 
                aria-label="SCADA Modality" 
                selectedKey={scadaMode} 
                onSelectionChange={handleModeChange}
                color="primary"
                variant="bordered"
                fullWidth
                classNames={{
                    tabList: "bg-default-100 p-1 rounded-lg",
                    cursor: "bg-white shadow-sm",
                    tab: "py-2"
                }}
            >
                <Tab 
                    key="discovery" 
                    title={
                        <div className="flex items-center gap-2">
                            <MdSearch className="text-lg" />
                            <span>Auto-Discovery</span>
                        </div>
                    }
                >
                    <div className="p-2 pt-4">
                        <div className="mb-4">
                            <label className="text-sm font-semibold">Monitored Machines</label>
                            <p className="text-xs text-text/50">
                                Select industrial machines in the same subnet (eth1) to monitor automatically.
                            </p>
                        </div>

                        {availableMachines.length > 0 ? (
                            <CheckboxGroup
                                color="primary"
                                value={selectedMachines}
                                onValueChange={handleSelectionChange}
                            >
                                <div className="grid grid-cols-1 gap-2">
                                    {availableMachines.map((m) => (
                                        <Checkbox 
                                            key={m.id} 
                                            value={m.id}
                                            classNames={{
                                                base: "max-w-full w-full bg-default-50 hover:bg-default-100 p-2 rounded-lg border border-transparent data-[selected=true]:border-primary transition-all",
                                                label: "w-full"
                                            }}
                                        >
                                            <div className="flex justify-between items-center w-full">
                                                <span className="font-medium">{m.name}</span>
                                                <span className="text-xs text-text/40">{m.interfaces?.if?.[0]?.ip || "no IP"}</span>
                                            </div>
                                        </Checkbox>
                                    ))}
                                </div>
                            </CheckboxGroup>
                        ) : (
                            <div className="text-sm text-text/50 p-4 bg-default-50 rounded-xl border border-dashed border-default-300 flex flex-col items-center text-center gap-2">
                                <MdSearch className="text-2xl text-default-400" />
                                <span>No industrial machines available on the same subnet (eth1).</span>
                            </div>
                        )}
                    </div>
                </Tab>
                <Tab 
                    key="project" 
                    title={
                        <div className="flex items-center gap-2">
                            <MdFileUpload className="text-lg" />
                            <span>Custom Project</span>
                        </div>
                    }
                >
                    <div className="p-2 pt-4">
                        <div className="mb-4">
                            <label className="text-sm font-semibold">Upload Project (.db)</label>
                            <p className="text-xs text-text/50">
                                Upload a pre-configured SCADA project database file.
                            </p>
                        </div>
                        
                        <div className="mt-1">
                            {!machine.industrial?.scadaProjectName ? (
                                <div className="relative group">
                                    <input
                                        type="file"
                                        accept=".db"
                                        id="scada-file-upload"
                                        className="sr-only"
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;

                                            const reader = new FileReader();
                                            reader.onload = () => {
                                                const base64Content = reader.result;
                                                setMachines(machines.map(m => {
                                                    if (m.id === machine.id) {
                                                        return {
                                                            ...m,
                                                            industrial: {
                                                                ...(m.industrial || {}),
                                                                scadaMode: "project",
                                                                scadaProjectName: file.name,
                                                                scadaProjectContent: base64Content,
                                                                monitored_machines: []
                                                            }
                                                        };
                                                    }
                                                    return m;
                                                }));
                                            };
                                            reader.readAsDataURL(file);
                                        }}
                                    />
                                    <label 
                                        htmlFor="scada-file-upload"
                                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-default-300 rounded-xl cursor-pointer bg-default-50 hover:bg-default-100 hover:border-primary transition-all group"
                                    >
                                        <MdFileUpload className="text-3xl text-default-400 group-hover:text-primary transition-colors" />
                                        <span className="mt-2 text-sm font-medium text-default-600 group-hover:text-primary">Click to upload .db project</span>
                                        <span className="text-xs text-default-400">FUXA database file</span>
                                    </label>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between p-3 bg-success-50 rounded-xl border border-success-200">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-success-100 rounded-lg text-success-600">
                                                <MdFileUpload className="text-xl" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-success-800 line-clamp-1">
                                                    {machine.industrial.scadaProjectName}
                                                </span>
                                                <span className="text-xs text-success-600">Ready for deployment</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="ml-4 text-xs font-bold text-danger-500 hover:text-danger-700 bg-danger-50 hover:bg-danger-100 px-3 py-1.5 rounded-lg transition-all"
                                            onClick={() => {
                                                setMachines(machines.map(m => {
                                                    if (m.id === machine.id) {
                                                        const { scadaProjectName, scadaProjectContent, ...rest } = m.industrial || {};
                                                        return {
                                                            ...m,
                                                            industrial: rest
                                                        };
                                                    }
                                                    return m;
                                                }));
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-text/40 text-center italic">
                                        Tip: This project will override the default SCADA configuration.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </Tab>
            </Tabs>
        </div>
    );
}
