/* eslint-disable react/no-array-index-key */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { Card, CardBody, CheckboxGroup, Checkbox, RadioGroup, Radio } from "@nextui-org/react";
import { useState } from "react";

function MachineSelector({machines, attacker, setTargets}) {
  const [view, setView] = useState("same"); // "same" | "others"

  const hasSameDomain = (m1, m2) => {
    const m1Domains = m1.interfaces.if.map((i) => i.eth.domain);
    const m2Domains = m2.interfaces.if.map((i) => i.eth.domain);
    return m1Domains.some((d) => m2Domains.includes(d));
  };

  return (
    <Card>
      <CardBody>
        {/* Toggle bello pulito in alto */}
        <RadioGroup
          orientation="horizontal"
          label="Select target group"
          value={view}
          onValueChange={setView}
          className="mb-2"
        >
          <Radio value="same">Machines in same subnet</Radio>
          <Radio value="others">All other machines</Radio>
        </RadioGroup>

        {/* Mostra SOLO il gruppo scelto */}
        {view === "same" && (
          <CheckboxGroup
            defaultValue={attacker.targets}
            onValueChange={(val) => setTargets(val)}
            orientation="horizontal"
            label="Select targets in the same subnet"
          >
            {machines.map((m, index) =>
              m.type !== "attacker" && hasSameDomain(attacker, m) && (
                <div key={index} className="grid grid-cols-2">
                  <Checkbox value={m}>{m.name}</Checkbox>
                </div>
              )
            )}
          </CheckboxGroup>
        )}

        {view === "others" && (
          <CheckboxGroup
            defaultValue={attacker.targets}
            onValueChange={(val) => setTargets(val)}
            orientation="horizontal"
            label="Select other targets"
          >
            {machines.map((m, index) =>
              m.type !== "attacker" && !hasSameDomain(attacker, m) && (
                <div key={index} className="grid grid-cols-2">
                  <Checkbox value={m}>{m.name}</Checkbox>
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