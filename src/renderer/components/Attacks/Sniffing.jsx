/* eslint-disable no-else-return */
/* eslint-disable prefer-template */
/* eslint-disable object-shorthand */
/* eslint-disable react/prop-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import { Card, CardBody, Input } from "@nextui-org/react";
import { Radio, RadioGroup } from "@nextui-org/react";
import { CheckboxGroup, Checkbox } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { useState, useContext, useEffect } from "react";
import { FaWrench } from "react-icons/fa6";
import { FaArrowRotateLeft } from "react-icons/fa6";
import { NotificationContext } from "../../contexts/NotificationContext";
import { XSymbol } from "../Symbols/XSymbol";
import { LogContext } from "../../contexts/LogContext";
import MachineSelector from "./MachineSelector";
import AttackSelector from "./AttackSelector";
import { extractTargetIPs } from "../../utils/ipUtils";



function Sniffing({ attacker, attacks, isLoading, machines, setMachines, handleRefresh }) {
  const [selectedImage, setSelectedImage] = useState(attacker.attackImage);
  const { attackLoaded, setAttackLoaded } = useContext(NotificationContext);
  const [targets, setTargets] = useState(attacker.targets);

  // Packet Sniffing Params
  const [interfaceName, setInterfaceName] = useState("eth1");
  const [time, setTime] = useState("10");

  useEffect(() => {
    if (attacker) {
      setSelectedImage(attacker.attackImage);
      setTargets(attacker.targets || []);
    }
  }, [attacker]);

  const isPacketSniffing = selectedImage && selectedImage.includes("packet-sniffing");

  const toggleAttack = (val) => {
    setMachines(machines.map((m) => {
      if (m.type === "attacker") {
        if (!attacker.attackLoaded) {

          const attackerDomain = attacker.interfaces?.if?.[0]?.eth?.domain;
          const cleanIps = extractTargetIPs(targets, attackerDomain);

          let attackArgs = [];
          // Check if it is packet sniffing
          if (val && val.includes("packet-sniffing")) {
            if (cleanIps.length !== 2) {
              console.warn("Packet sniffing requires exactly 2 targets");
            }
            // Order: time, interface, ip1, ip2
            attackArgs = ['bash', '/usr/local/bin/sniffing.sh', time, interfaceName, ...cleanIps];
          } else {
            attackArgs = ['sh', '/usr/local/bin/script.sh', ...cleanIps];
          }

          const attackCommandStr = attackArgs.join(' ');

          setAttackLoaded(true);
          return {
            ...m,
            name: val,
            targets: targets,
            attackLoaded: true,
            attackImage: val,
            attackCommandArgs: attackArgs,
            attackCommand: attackCommandStr,
          };
        } else {
          setAttackLoaded(false);
          return {
            ...m,
            targets: [],
            attackLoaded: false,
            attackImage: "",
            attackCommand: "",
            attackCommandArgs: [],
          };
        }
      } else {
        return m;
      }
    }));
  };

  return (
    <div className="flex flex-col auto-rows-max gap-2">
      <div className="grid items-start">
        <Button isLoading={isLoading} className="bg-secondary" startContent={isLoading ? null : <FaArrowRotateLeft />} onClick={handleRefresh}>{isLoading ? "Refreshing images..." : "Refresh images"}</Button>
      </div>
      <div className="flex-grow">
        <div className="grid gap-2">
          <MachineSelector machines={machines} setTargets={setTargets} attacker={attacker} />
          <AttackSelector type="sniffing" attacker={attacker} attacks={attacks} selectedImage={selectedImage} setSelectedImage={setSelectedImage} isLoading={isLoading} handleRefresh={handleRefresh} />

          {/* Params UI for Sniffing */}
          {isPacketSniffing && (
            <Card>
              <CardBody className="gap-2">
                <p className="text-sm font-bold">Packet Sniffing Parameters</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Interface"
                    size="sm"
                    value={interfaceName}
                    onValueChange={setInterfaceName}
                    placeholder="eth1"
                  />
                  <Input
                    label="Time (s)"
                    size="sm"
                    type="number"
                    value={time}
                    onValueChange={setTime}
                    placeholder="10"
                  />
                </div>
                <div className="text-xs text-warning">
                  Please select exactly 2 target machines for this attack.
                </div>
              </CardBody>
            </Card>
          )}

        </div>
      </div>
      <div className="grid">
        <Button
          isDisabled={selectedImage === ""}
          className={attacker.attackLoaded ? "bg-primary" : "bg-success"}
          startContent={attacker.attackLoaded && <XSymbol />}
          onClick={() => toggleAttack(selectedImage)}
        >
          {attacker.attackLoaded ? "Unload Attack" : "Load Attack"}
        </Button>
      </div>
    </div>
  )
}

export default Sniffing;
