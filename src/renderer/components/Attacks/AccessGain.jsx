/* eslint-disable no-else-return */
/* eslint-disable prefer-template */
/* eslint-disable object-shorthand */
/* eslint-disable react/prop-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import { Card, CardBody, Textarea } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { useState, useContext } from "react";
import { FaArrowRotateLeft } from "react-icons/fa6";
import { NotificationContext } from "../../contexts/NotificationContext";
import { XSymbol } from "../Symbols/XSymbol";
import MachineSelector from "./MachineSelector";
import AttackSelector from "./AttackSelector";
import { extractTargetIPs } from "../../utils/ipUtils";

function AccessGain({ attacker, attacks, isLoading, machines, setMachines, handleRefresh }) {
  const [selectedImage, setSelectedImage] = useState(attacker.attackImage || "icr/access-gain-crack-plc:latest");
  const { attackLoaded, setAttackLoaded } = useContext(NotificationContext);
  const [targets, setTargets] = useState(attacker.targets);

  const getEnvValue = (key) => {
    if (attacker.attackLoaded && attacker.attackImage?.includes("crack-plc")) {
      const args = attacker.attackCommandArgs || [];
      const entry = args.find(a => typeof a === 'string' && a.startsWith(`${key}=`));
      return entry ? entry.split("=")[1] : "";
    }
    return "";
  };

  const getConfig = (key, fallback) => {
    return attacker.attackConfig?.[key] || fallback;
  };






  const DEFAULT_USERNAMES = "blank\nnone\nADMIN\nroot\nROOT\nadm\nadmin\nAdmin\nADMIN\nAdministrator\nadministrator\nadm\nAny\nany\nopenplc";
  const DEFAULT_PASSWORDS = "123456\n12345\n123456789\npassword\niloveyou\nprincess\n1234567\n12345678\nabc123\nnicole\ndaniel\nbabygirl\nlovely\njessica\n654321\nmichael\nashley\nqwerty\n111111\niloveu\n000000\nmichelle\ntigger\nsunshine\nchocolate\npassword1\nsoccer\nanthony\nfriends\nbutterfly\npurple\nangel\njordan\nliverpool\njustin\nloveme\n123123\nfootball\nsecret\nandrea\ncarlos\njennifer\njoshua\nbubbles\n1234567890\nsuperman\nhannah\namanda\nloveyou\npretty\nbasketball\nandrew\nangels\nflower\nhello\nelizabeth\ncharlie\nsamantha\nchelsea\teamo\njasmine\nbrandon\n666666\nshadow\nmelissa\nmatthew\nrobert\ndanielle\nforever\nfamily\njonathan\n987654321\ncomputer\nwhatever\ndragon\nvanessa\ncookie\nsummer\nsweety\njoseph\njunior\nsoftball\ntaylor\nyellow\ndaniela\nlauren\nopenplc";

  const [usernames, setUsernames] = useState(() => getConfig("usernames", getEnvValue("USERNAMES") || DEFAULT_USERNAMES));
  const [passwords, setPasswords] = useState(() => getConfig("passwords", getEnvValue("PASSWORDS") || DEFAULT_PASSWORDS));
  const [view, setView] = useState(() => getConfig("view", "same"));

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

  const updateMachineData = (updates) => {
    setMachines(prevMachines => prevMachines.map(m => {
      if (m.type === "attacker") {
        return { ...m, ...updates };
      }
      return m;
    }));
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

  const toggleAttack = (val) => {
    setMachines(machines.map((m) => {
      if (m.type === "attacker") {
        if (!attacker.attackLoaded) {
          const attackerDomain = attacker.interfaces?.if?.[0]?.eth?.domain;
          const cleanIps = extractTargetIPs(targets, attackerDomain);

          let attackArgs = ['sh', '/usr/local/bin/script.sh', ...cleanIps];

          if (val && val.includes("crack-plc")) {
            attackArgs = [
              'env',
              `USERNAMES=${usernames || DEFAULT_USERNAMES}`,
              `PASSWORDS=${passwords || DEFAULT_PASSWORDS}`,
              `TARGET=${cleanIps[0] || ""}`,
              '/usr/local/bin/entrypoint.sh'
            ];
          }

          const attackCommandStr = attackArgs.join(' ');

          setAttackLoaded(true);
          return {
            ...m,
            targets: targets,
            attackLoaded: true,
            attackImage: val,
            attackCommandArgs: attackArgs,
            attackCommand: attackCommandStr,
            attackConfig: {
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
      <div className={`flex-grow transition-opacity duration-300 ${attacker?.attackLoaded ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="grid gap-2">
          <MachineSelector machines={machines} setTargets={handleTargetsChange} attacker={attacker} view={view} onViewChange={handleViewChange} />
          <AttackSelector type="access-gain" attacker={attacker} attacks={attacks} selectedImage={selectedImage} setSelectedImage={setSelectedImage} isLoading={isLoading} handleRefresh={handleRefresh} />

          {selectedImage && selectedImage.includes("crack-plc") && (
            <Card>
              <CardBody>
                <div className="grid gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Textarea label="Usernames" value={usernames} onValueChange={handleUsernamesChange} placeholder={DEFAULT_USERNAMES} />
                    <Textarea label="Passwords" value={passwords} onValueChange={handlePasswordsChange} placeholder={DEFAULT_PASSWORDS} />
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

export default AccessGain;
