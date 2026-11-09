/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { Input, Select, SelectItem, Switch, Button } from "@nextui-org/react";
import { XSymbol } from "../../Symbols/XSymbol";

function EntryTable({ label, rows, colA, colB, onChange }) {
    const add = () => onChange([...rows, { a: "", b: "" }]);
    const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
    const update = (i, field, val) => onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

    return (
        <div className="grid gap-1">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-default-500 uppercase tracking-wider">{label}</span>
                <Button size="sm" isIconOnly variant="flat" onPress={add} className="h-6 w-6 min-w-6">
                    <span className="text-base leading-none">+</span>
                </Button>
            </div>
            {rows.length > 0 && (
                <div className="grid gap-1">
                    {rows.map((row, i) => (
                        <div key={i} className="flex gap-1 items-center">
                            <Input size="sm" variant="flat" placeholder={colA} value={row.a} onValueChange={(v) => update(i, "a", v)} className="flex-1" />
                            <Input size="sm" variant="flat" placeholder={colB} value={row.b} onValueChange={(v) => update(i, "b", v)} className="flex-1" />
                            <Button size="sm" isIconOnly variant="flat" color="danger" onPress={() => remove(i)} className="h-7 w-7 min-w-7 shrink-0">
                                <XSymbol size={12} />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function CustomMachineFunctions({ machine, machines, setMachines }) {
    function updateMachineOther(updater) {
        setMachines(machines.map(m =>
            m.id !== machine.id ? m : { ...m, other: updater(m.other) }
        ));
    }

    function updateFieldValue(key, newValue) {
        updateMachineOther(other => ({
            ...other,
            fields: { ...(other.fields || {}), [key]: { ...(other.fields || {})[key], value: newValue } },
        }));
    }

    const fields = machine.other?.fields || {};
    const fieldEntries = Object.entries(fields);
    const volumes = machine.other?.volumes || [];
    const variables = machine.other?.variables || [];

    return (
        <div className="grid gap-3">
            {fieldEntries.map(([key, field]) => {
                if (field.type === "textbox") {
                    return (
                        <Input
                            key={key}
                            label={key}
                            value={field.value || ""}
                            onValueChange={(v) => updateFieldValue(key, v)}
                            size="sm"
                            variant="flat"
                        />
                    );
                }
                if (field.type === "spinbox") {
                    const isFloat = (field.numericKind || "integer") === "float";
                    const precision = field.precision || 2;
                    const step = isFloat ? Math.pow(10, -precision).toFixed(precision) : "1";
                    return (
                        <Input
                            key={key}
                            label={key}
                            type="number"
                            step={step}
                            value={field.value || "0"}
                            onValueChange={(v) => updateFieldValue(key, v)}
                            size="sm"
                            variant="flat"
                        />
                    );
                }
                if (field.type === "checkbox") {
                    return (
                        <div key={key} className="flex items-center gap-3">
                            <span className="text-sm text-default-700">{key}</span>
                            <Switch
                                size="sm"
                                isSelected={field.value === "true"}
                                onValueChange={(v) => updateFieldValue(key, v ? "true" : "false")}
                            />
                            <span className="text-xs text-default-400">{field.value === "true" ? "true" : "false"}</span>
                        </div>
                    );
                }
                if (field.type === "dropdown") {
                    return (
                        <Select
                            key={key}
                            label={key}
                            selectedKeys={field.value ? new Set([field.value]) : new Set()}
                            onSelectionChange={(keys) => updateFieldValue(key, Array.from(keys)[0] || "")}
                            size="sm"
                        >
                            {(field.entries || []).filter(e => e).map(entry => (
                                <SelectItem key={entry}>{entry}</SelectItem>
                            ))}
                        </Select>
                    );
                }
                return null;
            })}

            <EntryTable
                label="Volumes"
                rows={volumes}
                colA="source (e.g. /host/path:ro)"
                colB="container path"
                onChange={(rows) => updateMachineOther(other => ({ ...other, volumes: rows }))}
            />

            <EntryTable
                label="Variables"
                rows={variables}
                colA="key"
                colB="value"
                onChange={(rows) => updateMachineOther(other => ({ ...other, variables: rows }))}
            />
        </div>
    );
}
