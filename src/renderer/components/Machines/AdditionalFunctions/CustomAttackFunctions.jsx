/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { Input, Select, SelectItem, Switch } from "@nextui-org/react";

export function CustomAttackFunctions({ machine, machines, setMachines }) {
    function updateMachineAttacker(updater) {
        setMachines(machines.map(m =>
            m.id !== machine.id ? m : { ...m, attacker: updater(m.attacker) }
        ));
    }

    function updateFieldValue(defId, newValue) {
        updateMachineAttacker(attacker => ({
            ...attacker,
            fields: (attacker.fields || []).map(d =>
                d.id === defId ? { ...d, value: newValue } : d
            ),
        }));
    }

    const fields = machine.attacker?.fields || [];

    if (fields.length === 0) {
        return (
            <p className="text-xs text-default-400">
                No fields defined for this custom attack.
            </p>
        );
    }

    return (
        <div className="grid gap-3">
            {fields.map((field) => {
                if (field.type === "textbox") {
                    return (
                        <Input
                            key={field.id}
                            label={field.key}
                            value={field.value || ""}
                            onValueChange={(v) => updateFieldValue(field.id, v)}
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
                            key={field.id}
                            label={field.key}
                            type="number"
                            step={step}
                            value={field.value || "0"}
                            onValueChange={(v) => updateFieldValue(field.id, v)}
                            size="sm"
                            variant="flat"
                        />
                    );
                }

                if (field.type === "checkbox") {
                    return (
                        <div key={field.id} className="flex items-center gap-3">
                            <span className="text-sm text-default-700">{field.key}</span>
                            <Switch
                                size="sm"
                                isSelected={field.value === "true"}
                                onValueChange={(v) => updateFieldValue(field.id, v ? "true" : "false")}
                            />
                            <span className="text-xs text-default-400">{field.value === "true" ? "true" : "false"}</span>
                        </div>
                    );
                }

                if (field.type === "dropdown") {
                    return (
                        <Select
                            key={field.id}
                            label={field.key}
                            selectedKeys={field.value ? new Set([field.value]) : new Set()}
                            onSelectionChange={(keys) =>
                                updateFieldValue(field.id, Array.from(keys)[0] || "")
                            }
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
        </div>
    );
}
