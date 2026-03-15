/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import {Input, Select, SelectItem} from "@nextui-org/react";

export function TlsTerminationProxyFunctions({machine, machines, setMachines}) {
    const handleTlsChange = (e) => {
        const { name, value } = e.target;
        setMachines(machines.map(m => {
            if (m.id === machine.id) {
                return { ...m, tls: { ...m.tls, [name]: value } };
            }
            return m;
        }));
    };

    const handleTlsSelectChange = (e) => {
        const { value } = e.target;
        setMachines(machines.map(m => {
            if (m.id === machine.id) {
                return { ...m, tls: { ...m.tls, verify: value } };
            }
            return m;
        }));
    };

    const verifyOptions = [
        {key: "0", label: "Encryption only"},
        {key: "2", label: "Encryption + authentication"},
    ];

    return (
        <div className="grid gap-2">
            <Input
                label="Listen Interface"
                name="in_addr"
                value={machine.tls?.in_addr || ""}
                onChange={handleTlsChange}
            />
            <Input
                label="Outbound Address"
                name="out_addr"
                value={machine.tls?.out_addr || ""}
                onChange={handleTlsChange}
            />
            <Select
                label="Verify"
                name="verify"
                selectedKeys={[machine.tls?.verify || "0"]}
                onChange={handleTlsSelectChange}
            >
                {verifyOptions.map(option => (
                    <SelectItem key={option.key} value={option.key}>
                        {option.label}
                    </SelectItem>
                ))}
            </Select>
        </div>
    );
}
