/* eslint-disable react/no-array-index-key */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { Card, CardBody, CheckboxGroup, Checkbox } from "@nextui-org/react";

function MachineSelector({machines, attacker, setTargets}) {
    const hasSameDomain = (m1, m2) => {
        const m1Domains = m1.interfaces.if.map((i) => i.eth.domain);
        const m2Domains = m2.interfaces.if.map((i) => i.eth.domain);
        return m1Domains.some((d) => m2Domains.includes(d));
    }

    return (
        <Card>
            <CardBody>
                <CheckboxGroup defaultValue={attacker.targets} onValueChange={(val) => setTargets(val)} orientation="horizontal" label="Select machines">
                    {machines.map((m, index) => m.type !== "attacker" && hasSameDomain(attacker, m) && (
                        <div key={index} className="grid grid-cols-2">
                            <Checkbox value={m}>{m.name}</Checkbox>
                        </div>
                    ))}
                </CheckboxGroup>
            </CardBody>
        </Card>
    )
}

export default MachineSelector;
