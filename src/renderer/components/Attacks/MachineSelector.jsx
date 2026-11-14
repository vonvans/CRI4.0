/* eslint-disable react/no-array-index-key */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { Card, CardBody, CheckboxGroup, Checkbox, RadioGroup, Radio, Select, SelectItem } from "@nextui-org/react";
import { useState } from "react";

function MachineSelector({ machines, attacker, setTargets, view, onViewChange }) {
  const [internalView, setInternalView] = useState("same"); // "same" | "others"

  const currentView = view !== undefined ? view : internalView;

  const handleViewChange = (val) => {
    if (onViewChange) {
      onViewChange(val);
    } else {
      setInternalView(val);
    }
  };

  const hasSameDomain = (m1, m2) => {
    try {
      // In CRI4 or smoloki model, ifaces are usually in m.interfaces or m.interfaces.if
      const getDomains = (m) => {
        if (!m || !m.interfaces) return [];
        const ifaces = Array.isArray(m.interfaces) ? m.interfaces : (m.interfaces.if || []);
        return ifaces.map(i => i?.eth?.domain).filter(Boolean);
      };

      const m1Domains = getDomains(m1);
      const m2Domains = getDomains(m2);

      return m1Domains.some((d) => m2Domains.includes(d));
    } catch (e) {
      console.error("Error checking domains:", e);
      return false;
    }
  };

  const selectedKeys = attacker.targets ? attacker.targets.map((t) => t.name) : [];

  const handleSelectionChange = (keys) => {
    const selectedMachines = machines.filter((m) => keys.includes(m.name)).map((m) => {
      const existing = (attacker.targets || []).find((t) => t.name === m.name);
      if (existing && existing.selectedInterfaceIp) {
        return { ...m, selectedInterfaceIp: existing.selectedInterfaceIp };
      }
      return m;
    });
    setTargets(selectedMachines);
  };

  const getValidInterfaces = (m) => {
    if (!m || !m.interfaces) return [];
    const ifaces = Array.isArray(m.interfaces) ? m.interfaces : (m.interfaces.if || []);
    return ifaces.filter((i) => i && i.eth && i.eth.domain !== "_collector" && i.ip);
  };

  return (
    <Card>
      <CardBody>
        {/* Toggle bello pulito in alto */}
        <RadioGroup
          orientation="horizontal"
          label="Select target group"
          value={currentView}
          onValueChange={handleViewChange}
          className="mb-2"
        >
          <Radio value="same">Machines in same subnet</Radio>
          <Radio value="others">All other machines</Radio>
        </RadioGroup>

        {/* Mostra SOLO il gruppo scelto */}
        {currentView === "same" && (
          <CheckboxGroup
            value={selectedKeys}
            onValueChange={handleSelectionChange}
            orientation="horizontal"
            label="Select targets in the same subnet"
          >
            {machines.map((m, index) =>
              m.type !== "attacker" && hasSameDomain(attacker, m) && (
                <div key={index} className="flex gap-2 items-center mb-2 min-w-[200px]">
                  <Checkbox value={m.name}>{m.name}</Checkbox>
                  {selectedKeys.includes(m.name) && getValidInterfaces(m).length > 1 && (
                    <Select
                      size="sm"
                      label="Interface"
                      className="w-40 shrink-0"
                      selectedKeys={
                        (attacker.targets || []).find((t) => t.name === m.name)?.selectedInterfaceIp
                          ? new Set([(attacker.targets || []).find((t) => t.name === m.name).selectedInterfaceIp])
                          : new Set([])
                      }
                      onSelectionChange={(keys) => {
                        const selectedIp = Array.from(keys)[0];
                        if (selectedIp) {
                          const newTargets = (attacker.targets || []).map((t) => {
                            if (t.name === m.name) {
                              return { ...t, selectedInterfaceIp: selectedIp };
                            }
                            return t;
                          });
                          setTargets(newTargets);
                        }
                      }}
                    >
                      {getValidInterfaces(m).map((i) => {
                        const ipOnly = String(i.ip).split('/')[0].trim();
                        return (
                          <SelectItem key={ipOnly} value={ipOnly}>
                            {`${i.eth.domain} (${ipOnly})`}
                          </SelectItem>
                        );
                      })}
                    </Select>
                  )}
                </div>
              )
            )}
          </CheckboxGroup>
        )}

        {currentView === "others" && (
          <CheckboxGroup
            value={selectedKeys}
            onValueChange={handleSelectionChange}
            orientation="horizontal"
            label="Select other targets"
          >
            {machines.map((m, index) =>
              m.type !== "attacker" && !hasSameDomain(attacker, m) && (
                <div key={index} className="flex gap-2 items-center mb-2 min-w-[200px]">
                  <Checkbox value={m.name}>{m.name}</Checkbox>
                  {selectedKeys.includes(m.name) && getValidInterfaces(m).length > 1 && (
                    <Select
                      size="sm"
                      label="Interface"
                      className="w-40 shrink-0"
                      selectedKeys={
                        (attacker.targets || []).find((t) => t.name === m.name)?.selectedInterfaceIp
                          ? new Set([(attacker.targets || []).find((t) => t.name === m.name).selectedInterfaceIp])
                          : new Set([])
                      }
                      onSelectionChange={(keys) => {
                        const selectedIp = Array.from(keys)[0];
                        if (selectedIp) {
                          const newTargets = (attacker.targets || []).map((t) => {
                            if (t.name === m.name) {
                              return { ...t, selectedInterfaceIp: selectedIp };
                            }
                            return t;
                          });
                          setTargets(newTargets);
                        }
                      }}
                    >
                      {getValidInterfaces(m).map((i) => {
                        const ipOnly = String(i.ip).split('/')[0].trim();
                        return (
                          <SelectItem key={ipOnly} value={ipOnly}>
                            {`${i.eth.domain} (${ipOnly})`}
                          </SelectItem>
                        );
                      })}
                    </Select>
                  )}
                </div>
              )
            )}
          </CheckboxGroup>
        )}
      </CardBody>
    </Card>
  );
}

export default MachineSelector;