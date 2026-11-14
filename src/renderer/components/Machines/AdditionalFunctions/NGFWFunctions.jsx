import { Checkbox } from "@nextui-org/checkbox";
import { Switch } from "@nextui-org/switch";
import { Input } from "@nextui-org/input";
import { Select, SelectItem } from "@nextui-org/select";
import { Button } from "@nextui-org/button";

export function NGFWFunctions({ machine, machines, setMachines }) {

    function updateMachine(updater) {
        setMachines(() => machines.map((m) => m.id === machine.id ? updater(m) : m));
    }

    /* ── fwknop ── */
    function handleToggleRole(value) {
        updateMachine((m) => ({ ...m, ngfw: { ...(m.ngfw || {}), useFwknop: value } }));
    }

    function handleModbusProtectToggle(value) {
        updateMachine((m) => ({ ...m, ngfw: { ...(m.ngfw || {}), modbusProtect: value } }));
    }

    function handleModbusProtectRangeChange(value, targetMachineId) {
        updateMachine((m) => ({
            ...m,
            ngfw: {
                ...(m.ngfw || {}),
                modbusProtectAddr: { ...(m.ngfw?.modbusProtectAddr || {}), [targetMachineId]: value },
            },
        }));
    }

    function handleChange(value, targetMachineId) {
        updateMachine((m) => ({
            ...m,
            ngfw: {
                ...(m.ngfw || {}),
                targetMachines: { ...(m.ngfw?.targetMachines || {}), [targetMachineId]: value },
            },
        }));
    }

    /* ── WAF (array) ── */
    function addWaf() {
        updateMachine((m) => ({
            ...m,
            ngfw: {
                ...(m.ngfw || {}),
                wafRules: [
                    ...(m.ngfw?.wafRules || []),
                    { interface: "", input_port: "", output_endpoint: "", findtime: "", maxretry: "", bantime: "", page: "", http_code: "", protocol: "HTTP", method: "POST" },
                ],
            },
        }));
    }

    function removeWaf(idx) {
        updateMachine((m) => ({
            ...m,
            ngfw: {
                ...(m.ngfw || {}),
                wafRules: (m.ngfw?.wafRules || []).filter((_, i) => i !== idx),
            },
        }));
    }

    function handleWafChange(idx, field, value) {
        updateMachine((m) => {
            const rules = [...(m.ngfw?.wafRules || [])];
            rules[idx] = { ...rules[idx], [field]: value };
            return { ...m, ngfw: { ...(m.ngfw || {}), wafRules: rules } };
        });
    }

    /* ── Signature (array) ── */
    function addSignature() {
        updateMachine((m) => ({
            ...m,
            ngfw: {
                ...(m.ngfw || {}),
                signatures: [
                    ...(m.ngfw?.signatures || []),
                    { input_addr: "", output_addr: "", new_int: "", signature_name: "", signature_body: "", findtime: "", maxretry: "", bantime: "" },
                ],
            },
        }));
    }

    function removeSignature(idx) {
        updateMachine((m) => ({
            ...m,
            ngfw: {
                ...(m.ngfw || {}),
                signatures: (m.ngfw?.signatures || []).filter((_, i) => i !== idx),
            },
        }));
    }

    function handleSignatureChange(idx, field, value) {
        updateMachine((m) => {
            const sigs = [...(m.ngfw?.signatures || [])];
            sigs[idx] = { ...sigs[idx], [field]: value };
            return { ...m, ngfw: { ...(m.ngfw || {}), signatures: sigs } };
        });
    }

    const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
    const protocols = ["HTTP", "HTTPS"];

    const wafRules = machine.ngfw?.wafRules || [];
    const signatures = machine.ngfw?.signatures || [];

    return (
        <div className="flex flex-col gap-4">

            {/* ── fwknop ── */}
            <div className="flex flex-col gap-2 border-b border-gray-700 pb-4">
                <Switch isSelected={machine.ngfw?.useFwknop || false} onValueChange={handleToggleRole}>
                    Use fwknop
                </Switch>

                <Switch isSelected={machine.ngfw?.modbusProtect || false} onValueChange={handleModbusProtectToggle}>
                    Protect from modbus illegal registry address read
                </Switch>

                {machine.ngfw?.modbusProtect && (
                    <>
                        <label className="text-sm font-semibold mt-2">Target Machines to Protect</label>
                        <div className="grid grid-cols-2 gap-2">
                            {machines
                                .filter((m) => m.id !== machine.id)
                                .map((m) => (
                                    <Checkbox
                                        key={m.id}
                                        isSelected={machine.ngfw?.modbusProtectAddr?.[m.id] || false}
                                        onValueChange={(value) => handleModbusProtectRangeChange(value, m.id)}
                                    >
                                        {(m.name || `Machine ${m.id.substring(0, 4)}`) + (m.interfaces?.if?.find(i => i.eth?.number === 1)?.ip ? ` (${m.interfaces.if.find(i => i.eth?.number === 1).ip.split('/')[0]})` : (m.interfaces?.if?.[0]?.ip ? ` (${m.interfaces.if[0].ip.split('/')[0]})` : ""))}
                                    </Checkbox>
                                ))}
                        </div>
                        {machines.length <= 1 && (
                            <div className="text-sm text-gray-400 italic">No other machines created.</div>
                        )}
                    </>
                )}

                {machine.ngfw?.useFwknop && (
                    <>
                        <label className="text-sm font-semibold mt-2">Target Machines</label>
                        <div className="grid grid-cols-2 gap-2">
                            {machines
                                .filter((m) => m.id !== machine.id)
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

            {/* ── WAF rules ── */}
            <div className="flex flex-col gap-2 border-b border-gray-700 pb-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">WAF Rules</span>
                    <Button size="sm" variant="flat" onPress={addWaf} className="min-w-0 px-2">＋</Button>
                </div>

                {wafRules.map((rule, idx) => (
                    <div key={idx} className="flex flex-col gap-2 border border-gray-700 rounded-lg p-3 relative">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-400">Rule {idx + 1}</span>
                            <Button size="sm" variant="light" color="danger" onPress={() => removeWaf(idx)} className="min-w-0 px-2 h-6 text-xs">✕</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Select label="Interface" placeholder="Select Interface" selectedKeys={rule.interface ? [rule.interface] : []} onChange={(e) => handleWafChange(idx, "interface", e.target.value)} size="sm">
                                {(machine.interfaces?.if || []).map((i) => i.eth?.number !== undefined ? <SelectItem key={`eth${i.eth.number + 1}`} value={`eth${i.eth.number + 1}`}>{`eth${i.eth.number + 1}`}</SelectItem> : null)}
                            </Select>
                            <Input label="Input Port" placeholder="8080" value={rule.input_port || ""} onValueChange={(v) => handleWafChange(idx, "input_port", v)} size="sm" />
                            <Input className="col-span-2" label="Output Endpoint" placeholder="http://10.0.1.1:8080" value={rule.output_endpoint || ""} onValueChange={(v) => handleWafChange(idx, "output_endpoint", v)} size="sm" />
                            <Input label="Find Time" placeholder="10m" value={rule.findtime || ""} onValueChange={(v) => handleWafChange(idx, "findtime", v)} size="sm" />
                            <Input label="Max Retry" placeholder="5" type="number" value={rule.maxretry || ""} onValueChange={(v) => handleWafChange(idx, "maxretry", v)} size="sm" />
                            <Input label="Ban Time" placeholder="1h" value={rule.bantime || ""} onValueChange={(v) => handleWafChange(idx, "bantime", v)} size="sm" />
                            <Input label="Page" placeholder="/login" value={rule.page || ""} onValueChange={(v) => handleWafChange(idx, "page", v)} size="sm" />
                            <Input label="HTTP Code" placeholder="200" value={rule.http_code || ""} onValueChange={(v) => handleWafChange(idx, "http_code", v)} size="sm" />
                            <Select label="Protocol" selectedKeys={rule.protocol ? [rule.protocol] : []} onChange={(e) => handleWafChange(idx, "protocol", e.target.value)} size="sm">
                                {protocols.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </Select>
                            <Select label="Method" selectedKeys={rule.method ? [rule.method] : []} onChange={(e) => handleWafChange(idx, "method", e.target.value)} size="sm">
                                {httpMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </Select>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Signatures ── */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Signatures</span>
                    <Button size="sm" variant="flat" onPress={addSignature} className="min-w-0 px-2">＋</Button>
                </div>

                {signatures.map((sig, idx) => (
                    <div key={idx} className="flex flex-col gap-2 border border-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-400">Signature {idx + 1}</span>
                            <Button size="sm" variant="light" color="danger" onPress={() => removeSignature(idx)} className="min-w-0 px-2 h-6 text-xs">✕</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Input label="Input Addr" placeholder="10.0.0.1" value={sig.input_addr || ""} onValueChange={(v) => handleSignatureChange(idx, "input_addr", v)} size="sm" />
                            <Input label="Output Addr" placeholder="10.0.1.1" value={sig.output_addr || ""} onValueChange={(v) => handleSignatureChange(idx, "output_addr", v)} size="sm" />
                            <Select label="New Int" placeholder="Select Interface" selectedKeys={sig.new_int ? [sig.new_int] : []} onChange={(e) => handleSignatureChange(idx, "new_int", e.target.value)} size="sm">
                                {(machine.interfaces?.if || []).map((i) => i.eth?.number !== undefined ? <SelectItem key={`eth${i.eth.number + 1}`} value={`eth${i.eth.number + 1}`}>{`eth${i.eth.number + 1}`}</SelectItem> : null)}
                            </Select>
                            <Input label="Signature Name" placeholder="modbus-invalidreg" value={sig.signature_name || ""} onValueChange={(v) => handleSignatureChange(idx, "signature_name", v)} size="sm" />
                            <Input className="col-span-2" label="Signature Body" placeholder="alert tcp $HOME_NET 502 -> $EXTERNAL_NET any (...)" value={sig.signature_body || ""} onValueChange={(v) => handleSignatureChange(idx, "signature_body", v)} size="sm" />
                            <Input label="Find Time" placeholder="10m" value={sig.findtime || ""} onValueChange={(v) => handleSignatureChange(idx, "findtime", v)} size="sm" />
                            <Input label="Max Retry" placeholder="5" type="number" value={sig.maxretry || ""} onValueChange={(v) => handleSignatureChange(idx, "maxretry", v)} size="sm" />
                            <Input label="Ban Time" placeholder="1h" value={sig.bantime || ""} onValueChange={(v) => handleSignatureChange(idx, "bantime", v)} size="sm" />
                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
}
