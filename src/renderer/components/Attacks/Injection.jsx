/* eslint-disable no-else-return */
/* eslint-disable prefer-template */
/* eslint-disable object-shorthand */
/* eslint-disable react/prop-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import { Card, CardBody, Input, Textarea } from "@nextui-org/react";
import { Radio, RadioGroup } from "@nextui-org/react";
import { CheckboxGroup, Checkbox } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { useState } from "react";
import { FaWrench } from "react-icons/fa6";
import { FaArrowRotateLeft } from "react-icons/fa6";
import { useContext } from "react";
import { NotificationContext } from "../../contexts/NotificationContext";
import { XSymbol } from "../Symbols/XSymbol";
import { LogContext } from "../../contexts/LogContext";
import MachineSelector from "./MachineSelector";
import AttackSelector from "./AttackSelector";
import { extractTargetIPs } from "../../utils/ipUtils";

function Injection({ attacker, attacks, isLoading, machines, setMachines, handleRefresh }) {
  const [selectedImage, setSelectedImage] = useState(attacker.attackImage);
  const { attackLoaded, setAttackLoaded } = useContext(NotificationContext);
  const [targets, setTargets] = useState(attacker.targets);

  const getEnvValue = (key) => {
    if (attacker.attackLoaded && attacker.attackImage?.includes("modbustcp-injection")) {
      const args = attacker.attackCommandArgs || [];
      const entry = args.find(a => typeof a === 'string' && a.startsWith(`${key}=`));
      return entry ? entry.split("=")[1] : "";
    }
    return "";
  };

  // Helper to safely get config values from machine state
  const getConfig = (key, fallback) => {
    return attacker.attackConfig?.[key] || fallback;
  };

  // Initialize local state from machine config (if available) or env values (legacy/fallback)
  const [target1, setTarget1] = useState(() => getConfig("target1", getEnvValue("TARGET1")));
  const [target2, setTarget2] = useState(() => getConfig("target2", getEnvValue("TARGET2")));
  const [usernames, setUsernames] = useState(() => getConfig("usernames", getEnvValue("USERNAMES") || "root\nadmin\nuser\nopenplc"));
  const [passwords, setPasswords] = useState(() => getConfig("passwords", getEnvValue("PASSWORDS") || "password\n12345\nadmin\nroot\nopenplc"));
  const [view, setView] = useState(() => getConfig("view", "same"));

  // Update machine state whenever local state changes
  const updateMachineConfig = (key, value) => {
    setMachines(prevMachines => prevMachines.map(m => {
      if (m.type === "attacker") {
        return {
          ...m,
          attackConfig: {
            ...m.attackConfig,
            [key]: value
          }
        };
      }
      return m;
    }));
  };

  // Helper to update specific root-level properties of the attacker machine
  const updateMachineData = (updates) => {
    setMachines(prevMachines => prevMachines.map(m => {
      if (m.type === "attacker") {
        return { ...m, ...updates };
      }
      return m;
    }));
  };

  const handleTarget1Change = (val) => {
    setTarget1(val);
    updateMachineConfig("target1", val);
  };

  const handleTarget2Change = (val) => {
    setTarget2(val);
    updateMachineConfig("target2", val);
  };

  const handleUsernamesChange = (val) => {
    setUsernames(val);
    updateMachineConfig("usernames", val);
  };

  const handlePasswordsChange = (val) => {
    setPasswords(val);
    updateMachineConfig("passwords", val);
  };

  const handleViewChange = (val) => {
    setView(val);
    updateMachineConfig("view", val);
  };

  const handleTargetsChange = (val) => {
    setTargets(val);
    updateMachineData({ targets: val });
  };


  console.log(attacker.attackImage)

  const toggleAttack = (val) => {
    setMachines(machines.map((m) => {
      if (m.type === "attacker") {
        if (!attacker.attackLoaded) {
          // estrai gli IP puliti e unici
          const attackerDomain = attacker.interfaces?.if?.[0]?.eth?.domain;
          const cleanIps = extractTargetIPs(targets, attackerDomain);

          // costruisci l'array di argomenti (più sicuro)
          let attackArgs = ['sh', '/usr/local/bin/script.sh', ...cleanIps];

          if (val && val.includes("modbustcp-injection")) {
            // Per ModbusTCP injection, passiamo i parametri come variabili d'ambiente a entrypoint.sh
            // Assumiamo eth0 come interfaccia di default se non diversamente specificato
            const iface = "eth1";
            attackArgs = [
              'env',
              `INTERFACE=${iface}`,
              `TARGET1=${target1}`,
              `TARGET2=${target2}`,
              '/usr/local/bin/entrypoint.sh'
            ];
          }

          if (val && val.includes("crack-plc")) {
            attackArgs = [
              'env',
              `USERNAMES=${usernames}`,
              `PASSWORDS=${passwords}`,
              `TARGET=${cleanIps[0] || ""}`,
              '/usr/local/bin/entrypoint.sh'
            ];
          }

          // versione stringa leggibile (opzionale) per UI/log
          const attackCommandStr = attackArgs.join(' ');

          setAttackLoaded(true);
          return {
            ...m,
            name: "attacker",
            targets: targets,
            attackLoaded: true,
            attackImage: val,
            // salva ENTRAMBI: args + str
            attackCommandArgs: attackArgs,
            attackCommand: attackCommandStr,
            attackConfig: {
              target1,
              target2,
              usernames,
              passwords,
              view
            }
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
          <MachineSelector machines={machines} setTargets={handleTargetsChange} attacker={attacker} view={view} onViewChange={handleViewChange} />
          <AttackSelector type="injection" attacker={attacker} attacks={attacks} selectedImage={selectedImage} setSelectedImage={setSelectedImage} isLoading={isLoading} handleRefresh={handleRefresh} />

          {selectedImage && selectedImage.includes("modbustcp-injection") && (
            <Card>
              <CardBody>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Target 1 IP" value={target1} onValueChange={handleTarget1Change} placeholder="e.g. 192.168.1.10" />
                  <Input label="Target 2 IP" value={target2} onValueChange={handleTarget2Change} placeholder="e.g. 192.168.1.20" />
                </div>
              </CardBody>
            </Card>
          )}

          {selectedImage && selectedImage.includes("crack-plc") && (
            <Card>
              <CardBody>
                <div className="grid gap-2">
                  {/* Target is selected via checkboxes above */}

                  <div className="grid grid-cols-2 gap-2">
                    <Textarea label="Usernames" value={usernames} onValueChange={handleUsernamesChange} placeholder="admin\nroot" />
                    <Textarea label="Passwords" value={passwords} onValueChange={handlePasswordsChange} placeholder="openplc\n123456" />
                  </div>
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

export default Injection;
