import { Checkbox } from "@nextui-org/checkbox";
import { Switch } from "@nextui-org/switch";
import { Input } from "@nextui-org/input";
import { Select, SelectItem } from "@nextui-org/select";

export function NGFWFunctions({ machine, machines, setMachines }) {
    function handleChange(value, targetMachineId) {
        setMachines(() =>
            machines.map((m) => {
                if (m.id === machine.id) {
                    return {
                        ...m,
                        ngfw: {
                            ...(m.ngfw || {}),
                            targetMachines: {
                                ...(m.ngfw?.targetMachines || {}),
                                [targetMachineId]: value,
                            },
                        },
                    };
                } else {
                    return m;
                }
            })
        );
    }

    function handleToggleRole(value) {
        setMachines(() =>
            machines.map((m) => {
                if (m.id === machine.id) {
                    return {
                        ...m,
                        ngfw: {
                            ...(m.ngfw || {}),
                            useFwknop: value,
                        },
                    };
                } else {
                    return m;
                }
            })
        );
    }

    function handleNgfwChange(field, value) {
        setMachines(() =>
            machines.map((m) => {
                if (m.id === machine.id) {
                    return {
                        ...m,
                        ngfw: {
                            ...(m.ngfw || {}),
                            [field]: value,
                        },
                    };
                } else {
                    return m;
                }
            })
        );
    }

    function handleWafChange(field, value) {
        setMachines(() =>
            machines.map((m) => {
                if (m.id === machine.id) {
                    return {
                        ...m,
                        ngfw: {
                            ...(m.ngfw || {}),
                            waf: {
                                ...(m.ngfw?.waf || {}),
                                [field]: value,
                            },
                        },
                    };
                } else {
                    return m;
                }
            })
        );
    }

    function handleSignatureChange(field, value) {
        setMachines(() =>
            machines.map((m) => {
                if (m.id === machine.id) {
                    return {
                        ...m,
                        ngfw: {
                            ...(m.ngfw || {}),
                            signature: {
                                ...(m.ngfw?.signature || {}),
                                [field]: value,
                            },
                        },
                    };
                } else {
                    return m;
                }
            })
        );
    }

    const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
    const protocols = ["HTTP", "HTTPS"];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 border-b border-gray-700 pb-4">
                <Input
                    label="Input Endpoint"
                    placeholder="8080"
                    value={machine.ngfw?.listenport || ""}
                    onValueChange={(value) => handleNgfwChange("listenport", value)}
                    size="sm"
                />
                <Input
                    label="Endpoint"
                    placeholder="http://10.0.1.1:8080"
                    value={machine.ngfw?.endpoint || ""}
                    onValueChange={(value) => handleNgfwChange("endpoint", value)}
                    size="sm"
                />
            </div>

            <div className="flex flex-col gap-2 border-b border-gray-700 pb-4">
                <Switch
                    isSelected={machine.ngfw?.useFwknop || false}
                    onValueChange={handleToggleRole}
                >
                    Use fwknop
                </Switch>

                {machine.ngfw?.useFwknop && (
                    <>
                        <label className="text-sm font-semibold mt-2">Target Machines</label>
                        <div className="grid grid-cols-2 gap-2">
                            {machines
                                .filter((m) => m.id !== machine.id) // Optionally exclude self
                                .map((m) => (
                                    <Checkbox
                                        key={m.id}
                                        isSelected={machine.ngfw?.targetMachines?.[m.id] || false}
                                        onValueChange={(value) => handleChange(value, m.id)}
                                    >
                                        {m.name || `Machine ${m.id.substring(0, 4)}`}
                                    </Checkbox>
                                ))}
                        </div>
                        {machines.length <= 1 && (
                            <div className="text-sm text-gray-400 italic">No other machines created.</div>
                        )}
                    </>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <Switch
                    isSelected={machine.ngfw?.waf?.enabled || false}
                    onValueChange={(value) => handleWafChange("enabled", value)}
                >
                    Waf
                </Switch>

                {machine.ngfw?.waf?.enabled && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <Input
                            label="Endpoint"
                            placeholder="http://10.0.1.1:8080"
                            value={machine.ngfw?.waf?.endpoint || ""}
                            onValueChange={(value) => handleWafChange("endpoint", value)}
                            size="sm"
                        />
                        <Input
                            label="Find Time"
                            placeholder="10m"
                            value={machine.ngfw?.waf?.findtime || ""}
                            onValueChange={(value) => handleWafChange("findtime", value)}
                            size="sm"
                        />
                        <Input
                            label="Max Retry"
                            placeholder="5"
                            type="number"
                            value={machine.ngfw?.waf?.maxretry || ""}
                            onValueChange={(value) => handleWafChange("maxretry", value)}
                            size="sm"
                        />
                        <Input
                            label="Ban Time"
                            placeholder="1h"
                            value={machine.ngfw?.waf?.bantime || ""}
                            onValueChange={(value) => handleWafChange("bantime", value)}
                            size="sm"
                        />
                        <Input
                            label="Page"
                            placeholder="/login"
                            value={machine.ngfw?.waf?.page || ""}
                            onValueChange={(value) => handleWafChange("page", value)}
                            size="sm"
                        />
                        <Input
                            label="HTTP Code"
                            placeholder="200"
                            value={machine.ngfw?.waf?.http_code || ""}
                            onValueChange={(value) => handleWafChange("http_code", value)}
                            size="sm"
                        />
                        <Select
                            label="Protocol"
                            selectedKeys={machine.ngfw?.waf?.protocol ? [machine.ngfw.waf.protocol] : []}
                            onChange={(e) => handleWafChange("protocol", e.target.value)}
                            size="sm"
                        >
                            {protocols.map((proto) => (
                                <SelectItem key={proto} value={proto}>
                                    {proto}
                                </SelectItem>
                            ))}
                        </Select>
                        <Select
                            label="Method"
                            selectedKeys={machine.ngfw?.waf?.method ? [machine.ngfw.waf.method] : []}
                            onChange={(e) => handleWafChange("method", e.target.value)}
                            size="sm"
                        >
                            {httpMethods.map((method) => (
                                <SelectItem key={method} value={method}>
                                    {method}
                                </SelectItem>
                            ))}
                        </Select>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-700 pt-4">
                <Switch
                    isSelected={machine.ngfw?.signature?.enabled || false}
                    onValueChange={(value) => handleSignatureChange("enabled", value)}
                >
                    Signature
                </Switch>

                {machine.ngfw?.signature?.enabled && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <Input
                            label="Input Addr"
                            placeholder="10.0.0.1"
                            value={machine.ngfw?.signature?.input_addr || ""}
                            onValueChange={(value) => handleSignatureChange("input_addr", value)}
                            size="sm"
                        />
                        <Input
                            label="Output Addr"
                            placeholder="10.0.1.1"
                            value={machine.ngfw?.signature?.output_addr || ""}
                            onValueChange={(value) => handleSignatureChange("output_addr", value)}
                            size="sm"
                        />
                        <Input
                            label="New Int"
                            placeholder="eth1"
                            value={machine.ngfw?.signature?.new_int || ""}
                            onValueChange={(value) => handleSignatureChange("new_int", value)}
                            size="sm"
                        />
                        <Input
                            label="Signature Name"
                            placeholder="modbus-invalidreg"
                            value={machine.ngfw?.signature?.signature_name || ""}
                            onValueChange={(value) => handleSignatureChange("signature_name", value)}
                            size="sm"
                        />
                        <Input
                            className="col-span-2"
                            label="Signature Body"
                            placeholder="alert tcp $HOME_NET 502 -> $EXTERNAL_NET any (...)"
                            value={machine.ngfw?.signature?.signature_body || ""}
                            onValueChange={(value) => handleSignatureChange("signature_body", value)}
                            size="sm"
                        />
                        <Input
                            label="Find Time"
                            placeholder="10m"
                            value={machine.ngfw?.signature?.findtime || ""}
                            onValueChange={(value) => handleSignatureChange("findtime", value)}
                            size="sm"
                        />
                        <Input
                            label="Max Retry"
                            placeholder="5"
                            type="number"
                            value={machine.ngfw?.signature?.maxretry || ""}
                            onValueChange={(value) => handleSignatureChange("maxretry", value)}
                            size="sm"
                        />
                        <Input
                            label="Ban Time"
                            placeholder="1h"
                            value={machine.ngfw?.signature?.bantime || ""}
                            onValueChange={(value) => handleSignatureChange("bantime", value)}
                            size="sm"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
