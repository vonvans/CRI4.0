/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { RadioGroup, Radio } from "@nextui-org/radio";
import { Input } from "@nextui-org/input";
import { Select, SelectItem } from "@nextui-org/select";
import { Textarea } from "@nextui-org/input";
import { Button } from "@nextui-org/react";
import { TerminalFunctions } from "./TerminalFunctions";
import { NameserverFunctions } from "./NameserverFunctions";
import { RouterFunctions } from "./RouterFunctions/RouterFunctions";
import { WebServerFunctions } from "./WebServerFunctions";
import { OpenFlowRyu } from "./OpenFlowRyu";
import { OtherFunctions } from "./OtherFunctions";
import { TlsTerminationProxyFunctions } from "./TlsTerminationProxyFunctions";
import { NGFWFunctions } from "./NGFWFunctions";
import { IndustrialFunctions } from "./IndustrialFunctions";
import { ScadaFunctions } from "./ScadaFunctions";
import { CustomMachineFunctions } from "./CustomMachineFunctions";
import { CustomAttackFunctions } from "./CustomAttackFunctions";
import { NetproxyFunctions } from "./NetproxyFunctions";
import { DeviceFunctions } from "./DeviceFunctions";
import { MqttPubFunctions } from "./MqttPubFunctions";
import { MosquittoFunctions } from "./MosquittoFunctions";

export function AdditionalFunctions({ machine, machines, setMachines }) {
    return (
        <div className="h-full">
            {(() => {
                switch (machine.type) {
                    case 'netproxy':
                        return <NetproxyFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case 'device':
                        return <DeviceFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case 'mqtt_pub':
                        return <MqttPubFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case 'mosquitto':
                        return <MosquittoFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case 'terminal':
                        return <TerminalFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case 'attacker':
                        return null
                    case 'ns':
                        return <NameserverFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case 'router':
                        return <RouterFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case 'ws':
                        return <WebServerFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case 'ryu':
                        return <OpenFlowRyu
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case "other":
                        return machine.customTemplateId
                            ? <CustomMachineFunctions
                                machine={machine}
                                machines={machines}
                                setMachines={setMachines}
                            />
                            : <OtherFunctions
                                machine={machine}
                                machines={machines}
                                setMachines={setMachines}
                            />
                    case 'tls_termination_proxy':
                        return <TlsTerminationProxyFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case 'ngfw':
                        return <NGFWFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case 'engine':
                    case 'fan':
                    case 'temperature_sensor':
                    case 'plc':
                        return <IndustrialFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    case 'scada':
                        return <ScadaFunctions
                            machine={machine}
                            machines={machines}
                            setMachines={setMachines}
                        />
                    default:
                        return null
                }
            })()}
        </div>
    )
}

