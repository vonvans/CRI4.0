/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { useState } from "react";
import { Button, Tabs, Tab } from "@nextui-org/react";
import { Input } from "@nextui-org/input";
import { Select, SelectItem } from "@nextui-org/select";
import { MdFileUpload, MdDelete, MdAdd, MdSwapHoriz } from "react-icons/md";

// Collect the netproxy machine's configured interfaces so the user can pick
// which local IP the proxy listens on. Labels use the same eth(number+1)
// convention shown in the Network Interfaces panel (NetworkInterface.jsx). What
// actually matters for the netproxy rule is the IP (in_ip) it binds to.
function getInterfaceOptions(machine) {
    const opts = [];
    if (machine.interfaces && Array.isArray(machine.interfaces.if)) {
        for (const iface of machine.interfaces.if) {
            if (iface && iface.eth && typeof iface.ip === "string" && iface.ip.trim() !== "") {
                opts.push({ name: `eth${iface.eth.number + 1}`, ip: iface.ip.split("/")[0] });
            }
        }
    }
    return opts;
}

export function NetproxyFunctions({ machine, machines, setMachines }) {
    const rules = machine.netproxy?.rules || [];
    const ifaceOptions = getInterfaceOptions(machine);

    const [iface, setIface] = useState("");
    const [port, setPort] = useState("");
    const [sourceIp, setSourceIp] = useState("");
    const [sourcePort, setSourcePort] = useState("");

    const patchMachine = (patch) => {
        setMachines(machines.map((m) => (m.id === machine.id
            ? { ...m, netproxy: { ...(m.netproxy || {}), ...patch } }
            : m)));
    };

    const selectedIface = ifaceOptions.find((o) => o.name === iface);
    const canAdd = selectedIface && port.trim() !== "" && sourceIp.trim() !== "" && sourcePort.trim() !== "";

    const addRule = () => {
        if (!canAdd) return;
        const newRule = {
            name: `proxy-${rules.length + 1}`,
            proto: "tcp",
            in_ip: selectedIface.ip,
            in_iface: selectedIface.name,
            in_port: parseInt(port, 10),
            out_ip: sourceIp.trim(),
            out_port: parseInt(sourcePort, 10),
            interceptors: [],
        };
        patchMachine({ rules: [...rules, newRule] });
        setPort("");
        setSourceIp("");
        setSourcePort("");
    };

    const removeRule = (idx) => {
        patchMachine({ rules: rules.filter((_, i) => i !== idx) });
    };

    return (
        <Tabs
            aria-label="Netproxy configuration"
            color="primary"
            variant="bordered"
            fullWidth
            classNames={{
                tabList: "bg-default-100 p-1 rounded-lg",
                cursor: "bg-white shadow-sm",
                tab: "py-2",
            }}
        >
            {/* ---------- Proxy Rules ---------- */}
            <Tab key="rules" title="Proxy Rules">
                <div className="flex flex-col gap-3 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Select
                            size="sm"
                            label="Interface"
                            placeholder="Select interface"
                            selectedKeys={iface ? [iface] : []}
                            onSelectionChange={(keys) => setIface(Array.from(keys)[0] || "")}
                            isDisabled={ifaceOptions.length === 0}
                            description={ifaceOptions.length === 0 ? "No interfaces configured" : undefined}
                        >
                            {ifaceOptions.map((o) => (
                                <SelectItem key={o.name} value={o.name} textValue={`${o.name} (${o.ip})`}>
                                    {o.name} — {o.ip}
                                </SelectItem>
                            ))}
                        </Select>
                        <Input
                            size="sm"
                            type="number"
                            label="Port"
                            placeholder="1502"
                            value={port}
                            onValueChange={setPort}
                        />
                        <Input
                            size="sm"
                            label="Source IP"
                            placeholder="192.168.0.69"
                            value={sourceIp}
                            onValueChange={setSourceIp}
                        />
                        <Input
                            size="sm"
                            type="number"
                            label="Source Port"
                            placeholder="1502"
                            value={sourcePort}
                            onValueChange={setSourcePort}
                        />
                    </div>
                    <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<MdAdd className="text-lg" />}
                        isDisabled={!canAdd}
                        onClick={addRule}
                    >
                        Add rule
                    </Button>

                    {rules.length > 0 && (
                        <div className="flex flex-col gap-2">
                            {rules.map((r, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-2 bg-default-50 rounded-lg border border-default-200"
                                >
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="font-mono font-semibold text-default-700">
                                            {r.in_iface || r.in_ip}:{r.in_port}
                                        </span>
                                        <MdSwapHoriz className="text-default-400" />
                                        <span className="font-mono text-default-600">
                                            {r.out_ip}:{r.out_port}
                                        </span>
                                    </div>
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color="danger"
                                        aria-label="Remove rule"
                                        onClick={() => removeRule(idx)}
                                    >
                                        <MdDelete className="text-lg" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Tab>

            {/* ---------- Upload Config ---------- */}
            <Tab key="upload" title="Upload Config">
                <div className="flex flex-col gap-2 pt-2">
                    <label className="text-sm font-semibold">Upload Config (config.json)</label>
                    {rules.length > 0 && (
                        <p className="text-[11px] text-warning-600">
                            Proxy rules are defined in the Proxy Rules tab and take precedence over an uploaded file.
                        </p>
                    )}
                    {!machine.netproxy?.configName ? (
                        <div className="relative group">
                            <input
                                type="file"
                                accept=".json"
                                id={`netproxy-config-upload-${machine.id}`}
                                className="sr-only"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                        patchMachine({ configName: file.name, configContent: reader.result });
                                    };
                                    reader.readAsDataURL(file);
                                }}
                            />
                            <label
                                htmlFor={`netproxy-config-upload-${machine.id}`}
                                className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-default-300 rounded-xl cursor-pointer bg-default-50 hover:bg-default-100 hover:border-primary transition-all group"
                            >
                                <MdFileUpload className="text-2xl text-default-400 group-hover:text-primary transition-colors" />
                                <span className="mt-1 text-xs font-medium text-default-600 group-hover:text-primary">
                                    Click to upload config.json
                                </span>
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
                                        {machine.netproxy.configName}
                                    </span>
                                    <span className="text-[10px] text-success-600">Config loaded</span>
                                </div>
                            </div>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                aria-label="Remove config"
                                onClick={() => {
                                    setMachines(machines.map((m) => {
                                        if (m.id === machine.id) {
                                            const { configName, configContent, ...rest } = m.netproxy || {};
                                            return { ...m, netproxy: rest };
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
            </Tab>
        </Tabs>
    );
}
