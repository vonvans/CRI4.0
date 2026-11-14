/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { Button } from "@nextui-org/react";
import { MdFileUpload, MdDelete, MdDescription } from "react-icons/md";
import { MAIN_CONFIGS, syncDeviceMachines } from "../../../utils/deviceAutoCreate";

export function DeviceFunctions({ machine, machines, setMachines }) {
    const configs = machine.device?.configs || [];

    const addFiles = (files) => {
        const readers = Array.from(files).map((file) =>
            new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve({ name: file.name, content: reader.result });
                reader.readAsDataURL(file);
            })
        );
        Promise.all(readers).then((newConfigs) => {
            setMachines((prev) =>
                syncDeviceMachines(prev.map((m) => {
                    if (m.id === machine.id) {
                        // Replace files with the same name, append the others
                        const merged = [
                            ...configs.filter((c) => !newConfigs.some((n) => n.name === c.name)),
                            ...newConfigs,
                        ];
                        return { ...m, device: { ...(m.device || {}), configs: merged } };
                    }
                    return m;
                }))
            );
        });
    };

    const removeFile = (name) => {
        setMachines((prev) =>
            syncDeviceMachines(prev.map((m) => {
                if (m.id === machine.id) {
                    return {
                        ...m,
                        device: {
                            ...(m.device || {}),
                            configs: configs.filter((c) => c.name !== name),
                        },
                    };
                }
                return m;
            }))
        );
    };

    const missingMain = MAIN_CONFIGS.filter((name) => !configs.some((c) => c.name === name));

    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">Scenario configs</label>
            <p className="text-xs text-default-400">
                Upload <code>simulation.json</code>, <code>gateway.json</code>,{" "}
                <code>visualization.json</code> and one JSON file per Modbus device.
                A <code>physical_simulator</code> machine (10.2.x.x) and one
                machine per device config are created automatically.
            </p>

            <div className="relative group">
                <input
                    type="file"
                    accept=".json"
                    multiple
                    id={`device-config-upload-${machine.id}`}
                    className="sr-only"
                    onChange={(e) => {
                        if (e.target.files?.length) addFiles(e.target.files);
                        e.target.value = "";
                    }}
                />
                <label
                    htmlFor={`device-config-upload-${machine.id}`}
                    className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-default-300 rounded-xl cursor-pointer bg-default-50 hover:bg-default-100 hover:border-primary transition-all group"
                >
                    <MdFileUpload className="text-2xl text-default-400 group-hover:text-primary transition-colors" />
                    <span className="mt-1 text-xs font-medium text-default-600 group-hover:text-primary">
                        Click to upload scenario JSON files
                    </span>
                </label>
            </div>

            {configs.length > 0 && missingMain.length > 0 && (
                <p className="text-xs text-warning-600">
                    Missing {missingMain.join(", ")}: the default ones will be used.
                </p>
            )}

            {configs.map((cfg) => (
                <div
                    key={cfg.name}
                    className="flex items-center justify-between p-2 bg-success-50 rounded-xl border border-success-200"
                >
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-success-100 rounded-lg text-success-600">
                            <MdDescription className="text-lg" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-success-800 line-clamp-1">
                                {cfg.name}
                            </span>
                            <span className="text-[10px] text-success-600">
                                {MAIN_CONFIGS.includes(cfg.name) ? "Scenario config" : "Device config"}
                            </span>
                        </div>
                    </div>
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        aria-label={`Remove ${cfg.name}`}
                        onClick={() => removeFile(cfg.name)}
                    >
                        <MdDelete className="text-lg" />
                    </Button>
                </div>
            ))}
        </div>
    );
}
