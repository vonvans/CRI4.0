/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { RadioGroup, Radio } from "@nextui-org/radio";
import { Input } from "@nextui-org/input";
import { CheckboxGroup, Checkbox } from "@nextui-org/react";

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
        "plc"
    ];

    const availableMachinesForPlc = machines.filter((m) => {
        if (!industrialTypes.includes(m.type)) return false;
        if (m.id === machine.id) return false;

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
                            Select an engine from the same subnet (eth0)
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
                            No engines available on the same subnet (eth0).
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
                            Select industrial machines in the same subnet (eth0)
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
                            No industrial machines available on the same subnet (eth0).
                        </div>
                    )}

                    <label className="text-sm font-semibold">Upload Program</label>
                    <div className="mt-1">
                        <input
                            type="file"
                            accept=".st"
                            className="block w-full text-sm text-slate-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-md file:border-0
                                file:text-sm file:font-semibold
                                file:bg-primary-50 file:text-primary-700
                                hover:file:bg-primary-100"
                            onClick={() => console.log("PLC Input clicked")}
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
                                    alert(`Program "${file.name}" selected. It will be uploaded when you start the simulation.`);
                                };
                                reader.readAsDataURL(file);
                            }}
                        />
                        {machine.industrial?.plcProgramName && (
                            <div className="mt-1 flex flex-col gap-1">
                                <div className="text-xs text-success font-semibold">
                                    Current Program: {machine.industrial.plcProgramName}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                    {machine.industrial.plcProgramContent ?
                                        `Content loaded (${machine.industrial.plcProgramContent.length} chars)` :
                                        "No content loaded"}
                                </div>
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
