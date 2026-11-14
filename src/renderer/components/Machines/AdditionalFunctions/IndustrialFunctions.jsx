/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { RadioGroup, Radio } from "@nextui-org/radio";
import { Input } from "@nextui-org/input";
import { CheckboxGroup, Checkbox, Button } from "@nextui-org/react";
import { MdFileUpload, MdDelete, MdSearch } from "react-icons/md";
import { isHolderDevice } from "../../../utils/deviceAutoCreate";

function SineWaveGraph({ period, amplitude, tempOffset }) {
    const p = parseFloat(period) || 10;
    const a = parseFloat(amplitude) || 10;
    const o = parseFloat(tempOffset) || 20;

    const width = 120;
    const height = 60;
    const padding = 10;

    const points = [];
    // Draw 2 full periods
    for (let i = 0; i <= width; i++) {
        const xPct = i / width;
        const angle = xPct * 4 * Math.PI; // 0 to 4PI (2 cycles)
        const rawY = Math.sin(angle); // -1 to 1

        // Invert Y for SVG (0 is top)
        // Map -1..1 to height-padding..padding
        const y = ((-rawY + 1) / 2) * (height - 2 * padding) + padding;
        points.push(`${i},${y}`);
    }

    const minTemp = (o - a).toFixed(1);
    const maxTemp = (o + a).toFixed(1);
    const meanTemp = o.toFixed(1);

    return (
        <div className="mt-2 p-3 border rounded-medium border-default-200 bg-content2/20 flex flex-col items-center">
            <div className="flex w-full justify-between px-1 mb-1 text-[10px] text-default-500 font-mono">
                <span>Min: {minTemp}°C</span>
                <span>Max: {maxTemp}°C</span>
            </div>
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                {/* Midline (Mean) */}
                <line
                    x1="0" y1={height / 2}
                    x2={width} y2={height / 2}
                    stroke="currentColor"
                    strokeOpacity={0.2}
                    strokeDasharray="4 4"
                />

                {/* Sine Path */}
                <path
                    d={`M ${points.join(" L ")}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary"
                />
            </svg>
            <div className="w-full text-center mt-1 text-[10px] text-default-400">
                Visualization (2 cycles ~ {2 * p}s)
            </div>
        </div>
    );
}

export function IndustrialFunctions({ machine, machines, setMachines }) {
    // Find all engines on the same subnet (same eth0 domain)
    const machineEth0Domain = machine.interfaces?.if?.[0]?.eth?.domain;

    const availableEngines = machines.filter((m) => {
        if (m.type !== "engine") return false;
        if (m.id === machine.id) return false;

        // Check if the engine is on the same eth0 domain (subnet)
        const engineEth0Domain = m.interfaces?.if?.[0]?.eth?.domain;
        return engineEth0Domain && engineEth0Domain === machineEth0Domain;
    });

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

    const availableMachinesForPlc = machines.filter((m) => {
        if (!industrialTypes.includes(m.type)) return false;
        if (m.id === machine.id) return false;
        // Config holders are not deployed, so they cannot be monitored.
        if (isHolderDevice(m)) return false;

        const mEth0Domain = m.interfaces?.if?.[0]?.eth?.domain;
        return mEth0Domain && mEth0Domain === machineEth0Domain;
    });


    function handleMachineModeChange(isSineWave) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    industrial: {
                        ...(m.industrial || {}),
                        sineWave: isSineWave
                    }
                };
            }
            return m;
        }));
    }

    function handleSineWaveParamChange(param, value) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    industrial: {
                        ...(m.industrial || {}),
                        [param]: value
                    }
                };
            }
            return m;
        }));
    }

    function handleEngineChange(selectedEngineId) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    industrial: {
                        ...(m.industrial || {}),
                        selectedEngineId: selectedEngineId || null
                    }
                };
            }
            return m;
        }));
    }

    function handleCapacityChange(capacity) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    industrial: {
                        ...(m.industrial || {}),
                        capacity: capacity
                    }
                };
            }
            return m;
        }));
    }

    function handleOperationalModeChange(mode) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    industrial: {
                        ...(m.industrial || {}),
                        operationalMode: mode
                    }
                };
            }
            return m;
        }));
    }

    function handlePlcSelectionChange(values) {
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
            {machine.type === "engine" && (
                <div className="mb-4">
                    <label className="text-sm font-semibold">Operational Mode</label>
                    <RadioGroup
                        orientation="horizontal"
                        value={machine.industrial?.operationalMode || "engine"}
                        onValueChange={handleOperationalModeChange}
                    >
                        <Radio value="engine">Engine</Radio>
                        <Radio value="none">None</Radio>
                    </RadioGroup>
                </div>
            )}

            {machine.type === "temperature_sensor" && (
                <div className="mb-4">
                    <label className="text-sm font-semibold">Operation Mode</label>
                    <RadioGroup
                        orientation="horizontal"
                        value={machine.industrial?.sineWave ? "sine" : "engine"}
                        onValueChange={(val) => handleMachineModeChange(val === "sine")}
                    >
                        <Radio value="engine">Engine Connection</Radio>
                        <Radio value="sine">Sine Wave Simulation</Radio>
                    </RadioGroup>
                </div>
            )}

            {(machine.type === 'fan' || machine.type === 'temperature_sensor') && (!machine.industrial?.sineWave) && (
                <>
                    <div className="mb-2">
                        <label className="text-sm font-semibold">Machine Selection</label>
                        <p className="text-xs text-text/50">
                            Select an engine from the same subnet (eth1)
                        </p>
                    </div>

                    {availableEngines.length > 0 ? (
                        <RadioGroup
                            color="primary"
                            value={machine.industrial?.selectedEngineId || ""}
                            onValueChange={handleEngineChange}
                        >
                            <Radio value="">None</Radio>
                            {availableEngines.map((engine) => (
                                <Radio key={engine.id} value={engine.id}>
                                    {engine.name} ({engine.interfaces?.if?.[0]?.ip || "no IP"})
                                </Radio>
                            ))}
                        </RadioGroup>
                    ) : (
                        <div className="text-sm text-text/50 p-2 bg-default-100 rounded">
                            No engines available on the same subnet (eth1).
                            Add an engine and connect it to the same collision domain.
                        </div>
                    )}
                </>
            )}

            {machine.type === "temperature_sensor" && machine.industrial?.sineWave && (
                <div className="mt-2 flex flex-col gap-2">
                    <Input
                        type="number"
                        label="Period"
                        placeholder="10"
                        value={machine.industrial?.period || ""}
                        onChange={(e) => handleSineWaveParamChange("period", e.target.value)}
                        description="Wave period in seconds"
                    />
                    <Input
                        type="number"
                        label="Amplitude"
                        placeholder="10"
                        value={machine.industrial?.amplitude || ""}
                        onChange={(e) => handleSineWaveParamChange("amplitude", e.target.value)}
                        description="Wave amplitude (C)"
                    />
                    <Input
                        type="number"
                        label="Temp Offset"
                        placeholder="20"
                        value={machine.industrial?.tempOffset || ""}
                        onChange={(e) => handleSineWaveParamChange("tempOffset", e.target.value)}
                        description="Temperature offset (C)"
                    />
                    <SineWaveGraph
                        period={machine.industrial?.period}
                        amplitude={machine.industrial?.amplitude}
                        tempOffset={machine.industrial?.tempOffset}
                    />
                </div>
            )}

            {machine.type === "fan" && (
                <div className="mt-4">
                    <Input
                        type="number"
                        label="Capacity"
                        placeholder="2.0"
                        value={machine.industrial?.capacity || ""}
                        onChange={(e) => handleCapacityChange(e.target.value)}
                        description="Fan capacity value"
                    />
                </div>
            )}

            {machine.type === "plc" && (
                <div className="mt-2">
                    <div className="mb-2">
                        <label className="text-sm font-semibold">Monitored Machines</label>
                        <p className="text-xs text-text/50">
                            Select industrial machines in the same subnet (eth1)
                        </p>
                    </div>

                    {availableMachinesForPlc.length > 0 ? (
                        <CheckboxGroup
                            color="primary"
                            value={machine.industrial?.monitored_machines || []}
                            onValueChange={handlePlcSelectionChange}
                        >
                            {availableMachinesForPlc.map((m) => (
                                <Checkbox key={m.id} value={m.id}>
                                    {m.name} ({m.interfaces?.if?.[0]?.ip || "no IP"})
                                </Checkbox>
                            ))}
                        </CheckboxGroup>
                    ) : (
                        <div className="text-sm text-text/50 p-2 bg-default-100 rounded mb-2">
                            No industrial machines available on the same subnet (eth1).
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold">Upload Program (.st)</label>
                        {!machine.industrial?.plcProgramName ? (
                            <div className="relative group">
                                <input
                                    type="file"
                                    accept=".st"
                                    id="plc-file-upload"
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
                                                            plcProgramName: file.name,
                                                            plcProgramContent: base64Content
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
                                    htmlFor="plc-file-upload"
                                    className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-default-300 rounded-xl cursor-pointer bg-default-50 hover:bg-default-100 hover:border-primary transition-all group"
                                >
                                    <MdFileUpload className="text-2xl text-default-400 group-hover:text-primary transition-colors" />
                                    <span className="mt-1 text-xs font-medium text-default-600 group-hover:text-primary">Click to upload .st program</span>
                                </label>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-2 bg-success-50 rounded-xl border border-success-200">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-success-100 rounded-lg text-success-600">
                                        <MdFileUpload className="text-lg" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-success-800 line-clamp-1">
                                            {machine.industrial.plcProgramName}
                                        </span>
                                        <span className="text-[10px] text-success-600">Program loaded</span>
                                    </div>
                                </div>
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    aria-label="Remove program"
                                    onClick={() => {
                                        setMachines(machines.map(m => {
                                            if (m.id === machine.id) {
                                                const { plcProgramName, plcProgramContent, ...rest } = m.industrial || {};
                                                return {
                                                    ...m,
                                                    industrial: rest
                                                };
                                            }
                                            return m;
                                        }));
                                    }}
                                >
                                    <MdDelete className="text-lg" />
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="mt-2">
                        <Input
                            type="text"
                            label="PLC Password"
                            placeholder="openplc"
                            value={machine.industrial?.password || ""}
                            onChange={(e) => {
                                setMachines(machines.map(m => {
                                    if (m.id === machine.id) {
                                        return {
                                            ...m,
                                            industrial: {
                                                ...(m.industrial || {}),
                                                password: e.target.value
                                            }
                                        };
                                    }
                                    return m;
                                }));
                            }}
                            description="Set the password for the 'openplc' user"
                        />
                    </div>
                </div>
            )}


        </div>
    );
}
