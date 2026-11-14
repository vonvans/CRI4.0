/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import React, { useState, useContext } from "react";
import { Card, CardBody } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { Input, Select, SelectItem, Switch } from "@nextui-org/react";
import { XSymbol } from "../Symbols/XSymbol";
import MachineSelector from "./MachineSelector";
import { NotificationContext } from "../../contexts/NotificationContext";


function EntryTable({ label, rows, colA, colB, onChange, isReadOnly }) {
  const add = () => onChange([...rows, { a: "", b: "" }]);
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  return (
    <div className="grid gap-1 mb-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-default-500 uppercase tracking-wider">{label}</span>
        {!isReadOnly && (
          <Button size="sm" isIconOnly variant="flat" onPress={add} className="h-6 w-6 min-w-6">
            <span className="text-base leading-none">+</span>
          </Button>
        )}
      </div>
      {rows.length > 0 && (
        <div className="grid gap-1">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-1 items-center">
              <Input size="sm" variant="flat" placeholder={colA} value={row.a} onValueChange={(v) => update(i, "a", v)} className="flex-1" isReadOnly={isReadOnly} />
              <Input size="sm" variant="flat" placeholder={colB} value={row.b} onValueChange={(v) => update(i, "b", v)} className="flex-1" isReadOnly={isReadOnly} />
              {!isReadOnly && (
                <Button size="sm" isIconOnly variant="flat" color="danger" onPress={() => remove(i)} className="h-7 w-7 min-w-7 shrink-0">
                  <XSymbol size={12} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldInputs({ fields, onFieldChange, isReadOnly }) {
  const entries = Object.entries(fields || {});
  if (entries.length === 0) return null;
  return (
    <div className="grid gap-3 mb-4">
      {entries.map(([key, field]) => {
        if (field.type === "textbox") {
          return (
            <Input
              key={key}
              label={key}
              value={field.value || ""}
              onValueChange={(v) => onFieldChange(key, v)}
              size="sm"
              variant="flat"
              isReadOnly={isReadOnly}
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
              onValueChange={(v) => onFieldChange(key, v)}
              size="sm"
              variant="flat"
              isReadOnly={isReadOnly}
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
                isDisabled={isReadOnly}
                onValueChange={(v) => onFieldChange(key, v ? "true" : "false")}
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
              onSelectionChange={(keys) => onFieldChange(key, Array.from(keys)[0] || "")}
              size="sm"
              isDisabled={isReadOnly}
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

function CustomAttacks({ attacker, machines, setMachines }) {
  const [customAttackTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem("customAttacks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const isLoaded = !!attacker?.customAttackId;
  const loadedId = attacker?.customAttackId || "";

  const [expandedId, setExpandedId] = useState(loadedId || "");
  const [selectedId, setSelectedId] = useState(loadedId || "");
  const [fields, setFields] = useState(() => {
    if (isLoaded && attacker?.attacker?.fields && !Array.isArray(attacker.attacker.fields)) {
      return { ...attacker.attacker.fields };
    }
    const tpl = customAttackTemplates.find(t => t.id === (loadedId || customAttackTemplates[0]?.id));
    return { ...((tpl?.manifest || {}).fields || {}) };
  });
  const [volumes, setVolumes] = useState(() => attacker?.attacker?.volumes || []);
  const [variables, setVariables] = useState(() => attacker?.attacker?.variables || []);
  const [targets, setTargets] = useState(attacker?.targets || []);

  const { setAttackLoaded } = useContext(NotificationContext);

  const updateMachineData = (updates) => {
    setMachines(prev => prev.map(m => m.type === "attacker" ? { ...m, ...updates } : m));
  };

  const handleTargetsChange = (val) => {
    setTargets(val);
    updateMachineData({ targets: val });
  };

  const handleFieldChange = (key, value) => {
    setFields(prev => ({ ...prev, [key]: { ...prev[key], value } }));
  };

  const handleRowClick = (id) => {
    if (isLoaded) {
      if (loadedId === id) setExpandedId(prev => prev === id ? "" : id);
      return;
    }
    if (expandedId === id) {
      setExpandedId("");
    } else {
      setSelectedId(id);
      setExpandedId(id);
      const tpl = customAttackTemplates.find(t => t.id === id);
      if (tpl) {
        setFields({ ...((tpl.manifest || {}).fields || {}) });
      }
    }
  };

  const toggleAttack = () => {
    if (isLoaded) {
      updateMachineData({
        customAttackId: null,
        attackLoaded: false,
        attackImage: "",
        attackCommand: "",
        attackCommandArgs: [],
        attacker: { image: "", fields: {}, dockerFlags: [], logo: "", volumes: [], variables: [] },
      });
      setAttackLoaded(false);
      return;
    }
    const tpl = customAttackTemplates.find(t => t.id === selectedId);
    if (!tpl) return;
    const manifest = tpl.manifest || {};
    updateMachineData({
      customAttackId: tpl.id,
      attackLoaded: true,
      attackImage: tpl.image,
      attackCommand: "",
      attackCommandArgs: [],
      attacker: {
        image: tpl.image,
        fields: { ...fields },
        dockerFlags: (manifest.dockerFlags || []).map(f => ({ ...f })),
        logo: tpl.logo || "",
        volumes: [...volumes],
        variables: [...variables],
      },
      targets: targets,
    });
    setAttackLoaded(true);
  };

  if (customAttackTemplates.length === 0) {
    return (
      <Card>
        <CardBody className="grid place-items-center py-8">
          <p className="text-default-400 text-sm">
            No custom attacks defined. Use &ldquo;Create Machine&rdquo; in Settings to define one.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Card>
        <CardBody className="p-0 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-divider">
                <th className="text-left px-4 py-2 text-xs font-semibold text-default-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-default-500 uppercase tracking-wider">Image</th>
              </tr>
            </thead>
            <tbody>
              {customAttackTemplates.map((tpl) => {
                const isSelected = isLoaded ? loadedId === tpl.id : selectedId === tpl.id;
                const isExpanded = expandedId === tpl.id;
                const isOtherLoaded = isLoaded && loadedId !== tpl.id;
                const visibleFields = isLoaded && loadedId === tpl.id
                  ? (attacker?.attacker?.fields || {})
                  : fields;
                const visibleVolumes = isLoaded && loadedId === tpl.id
                  ? (attacker?.attacker?.volumes || [])
                  : volumes;
                const visibleVariables = isLoaded && loadedId === tpl.id
                  ? (attacker?.attacker?.variables || [])
                  : variables;
                return (
                  <React.Fragment key={tpl.id}>
                    <tr
                      className="border-b border-divider transition-colors"
                      style={{
                        backgroundColor: isSelected ? "#BE2222" : undefined,
                        cursor: isOtherLoaded ? "default" : "pointer",
                        opacity: isOtherLoaded ? 0.4 : 1,
                      }}
                      onClick={() => handleRowClick(tpl.id)}
                    >
                      <td className="px-4 py-3 text-sm font-medium">{tpl.name}</td>
                      <td className="px-4 py-3 text-xs text-default-400 font-mono">{tpl.image}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={2} className="px-4 py-4 bg-default-50 border-b border-divider">
                          {attacker && (
                            <div className={`mb-4 ${isLoaded ? "opacity-50 pointer-events-none" : ""}`}>
                              <MachineSelector
                                machines={machines}
                                attacker={attacker}
                                setTargets={handleTargetsChange}
                              />
                            </div>
                          )}
                          <FieldInputs
                            fields={visibleFields}
                            onFieldChange={handleFieldChange}
                            isReadOnly={isLoaded}
                          />
                          <EntryTable
                            label="Volumes"
                            rows={visibleVolumes}
                            colA="source (e.g. /host/path:ro)"
                            colB="container path"
                            onChange={setVolumes}
                            isReadOnly={isLoaded}
                          />
                          <EntryTable
                            label="Variables"
                            rows={visibleVariables}
                            colA="key"
                            colB="value"
                            onChange={setVariables}
                            isReadOnly={isLoaded}
                          />
                          <Button
                            color={isLoaded ? "primary" : "success"}
                            startContent={isLoaded ? <XSymbol /> : null}
                            isDisabled={!attacker}
                            onClick={toggleAttack}
                          >
                            {isLoaded ? "Unload Attack" : "Load Attack"}
                          </Button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

export default CustomAttacks;
