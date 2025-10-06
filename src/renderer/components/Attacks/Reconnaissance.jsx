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
import { useState } from "react";
import { FaWrench } from "react-icons/fa6";
import { FaArrowRotateLeft } from "react-icons/fa6";
import { useContext } from "react";
import { NotificationContext } from "../../contexts/NotificationContext";
import { XSymbol } from "../Symbols/XSymbol";
import { LogContext } from "../../contexts/LogContext";
import MachineSelector from "./MachineSelector";
import AttackSelector from "./AttackSelector";

function Reconnaissance({attacker, attacks, isLoading, machines, setMachines, handleRefresh}) {
    const [selectedImage, setSelectedImage] = useState(attacker.attackImage);
    const { attackLoaded, setAttackLoaded } = useContext(NotificationContext);
    const [targets, setTargets] = useState(attacker.targets);

    console.log(attacker.attackImage)

    // aggiungi sopra il componente (o in util separato)
const ipRegex = /^(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\.(?:25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/;

function extractTargetIPs(targets = [], attackerDomain) {
  // targets: array di oggetti macchina (come li usi), attackerDomain: es. "lan1"
  // ritorna array di IP (no cidr, senza duplicati)
  const ips = [];

  targets.forEach((t) => {
    if (!t || !t.interfaces || !Array.isArray(t.interfaces.if)) return;

    // per ciascuna interfaccia del target, prendi l'ip se la domain corrisponde
    t.interfaces.if.forEach((iface) => {
      try {
        if (iface && iface.eth && iface.eth.domain === attackerDomain && iface.ip) {
          // split per rimuovere il /cidr se presente
          const ipOnly = String(iface.ip).split('/')[0].trim();
          if (ipRegex.test(ipOnly)) {
            ips.push(ipOnly);
          }
        }
      } catch (e) {
        // ignore malformed entries
      }
    });
  });

  // dedup
  return Array.from(new Set(ips));
}

// helper: trova definizione attacco
function getAttackDefinition(attackName) {
  if (!Array.isArray(attacks)) return null;
  return attacks.find(a => a.name === attackName || a.image === attackName || a.displayName === attackName) || null;
}

/*const toggleAttack = (val) => {
  setMachines(machines.map((m) => {
    if (m.type === "attacker") {
      if (!attacker.attackLoaded) {
        // estrai gli IP puliti e unici
        const attackerDomain = attacker.interfaces?.if?.[0]?.eth?.domain;
        const cleanIps = extractTargetIPs(targets, attackerDomain);

        // costruisci l'array di argomenti (più sicuro)
        const attackDef = getAttackDefinition(val);

        const scriptPath = attackDef?.script || "/usr/local/bin/script.sh";
        const entrypoint = attackDef?.entrypoint || null;


        // costruisci l'array dei comandi in modo sicuro
        let attackArgs;
        if (entrypoint) {
          // es: ["python3", "/usr/local/bin/icmp_scan_scapy.py", "10.0.0.5", "10.0.0.6"]
          attackArgs = [entrypoint, scriptPath, ...cleanIps];
        } else {
          // se lo script è eseguibile con shebang o è uno shell script
          // useremo "sh" come default per safety se ha estensione .sh
          if (scriptPath.endsWith(".sh")) {
            attackArgs = ["sh", scriptPath, ...cleanIps];
          } else {
            attackArgs = [scriptPath, ...cleanIps];
          }
        }
        

        // versione stringa leggibile (opzionale) per UI/log
        const attackCommandStr = attackArgs.join(' ');

        setAttackLoaded(true);
        return {
          ...m,
          name: val,
          targets: targets,
          attackLoaded: true,
          attackImage: val,
          // salva ENTRAMBI: args + str
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
*/

/*const toggleAttack = (val) => {
  setMachines((prevMachines) => {
    // trova attacker corrente (quello collegato all'immagine selezionata)
    // oppure identifica l'attacker "principale" con type === "attacker"
    // se hai più attacker potresti aggiustare la logica per match su id/name
    const attackerIndex = prevMachines.findIndex(m => m.type === "attacker");

    // build nuovo array machines resettando tutti gli attacker
    const machinesReset = prevMachines.map((m) => {
      if (m.type === "attacker") {
        return {
          ...m,
          targets: [],
          attackLoaded: false,
          attackImage: "",
          attackCommand: "",
          attackCommandArgs: [],
          name: m.name || "",
        };
      }
      return m;
    });

    // se non trovi attacker, ritorna stato resettato
    if (attackerIndex === -1) return machinesReset;

    // se ora vogliamo caricare l'attacco (val non vuoto) -> costruisci args e imposta solo quel machine
    const attackDef = getAttackDefinition ? getAttackDefinition(val) : null; // se hai helper
    // fallbacks
    const scriptPath = attackDef?.script || "/usr/local/bin/script.sh";
    const entrypoint = attackDef?.entrypoint || null;

    // estrai attacker (prima versione) dai prevMachines (non dai machinesReset per leggere il dominio)
    const currAttacker = prevMachines[attackerIndex];
    const attackerDomain = currAttacker?.interfaces?.if?.[0]?.eth?.domain;
    const cleanIps = extractTargetIPs(targets, attackerDomain);

    // se l'attacco è già caricato (vuoi toggle unload) -> lo rimuoviamo (comportamento toggle)
    // ma dato che abbiamo resettato tutto sopra, possiamo interpretare val === "" come unload
    if (currAttacker.attackLoaded) {
      // già resettato in machinesReset, ritorna quello
      return machinesReset;
    }

    // costruiamo args (sicuro)
    let attackArgs;
    if (entrypoint) {
      attackArgs = [entrypoint, scriptPath, ...cleanIps];
    } else if (scriptPath.endsWith(".py")) {
      attackArgs = ["python3", scriptPath, ...cleanIps];
    } else if (scriptPath.endsWith(".sh")) {
      attackArgs = ["sh", scriptPath, ...cleanIps];
    } else {
      attackArgs = [scriptPath, ...cleanIps];
    }

    const attackCommandStr = attackArgs.join(" ");

    // aggiorna solo il machine attackerIndex con le info dell'attacco caricato
    machinesReset[attackerIndex] = {
      ...machinesReset[attackerIndex],
      name: val,
      targets: cleanIps,
      attackLoaded: true,
      attackImage: val,
      attackCommandArgs: attackArgs,
      attackCommand: attackCommandStr,
    };

    return machinesReset;
  });

  // aggiorna anche il NotificationContext locale/state se necessario
  setAttackLoaded(true);
};
*/

// helper: cerca definizione attacco (se non esiste già)
function getAttackDefinition(attackName) {
  if (!Array.isArray(attacks)) return null;
  return attacks.find(a => a.name === attackName || a.image === attackName || a.displayName === attackName) || null;
}

const toggleAttack = (val) => {
  setMachines((prevMachines) => {
    // trova indice dell'attacker "principale"
    const attackerIndex = prevMachines.findIndex(m => m.type === "attacker");

    // resetta tutti gli attacker nello stato nuovo
    const machinesReset = prevMachines.map((m) => {
      if (m.type === "attacker") {
        return {
          ...m,
          targets: [],
          attackLoaded: false,
          attackImage: "",
          attackCommand: "",
          attackCommandArgs: [],
          name: m.name || "",
        };
      }
      return m;
    });

    // se non trovi attacker, ritorna lo stato resettato
    if (attackerIndex === -1) return machinesReset;

    // leggi l'attacker corrente dallo stato precedente (per es. per ricavare domain)
    const currAttacker = prevMachines[attackerIndex];

    // se stiamo facendo "toggle unload" (l'attacker è già caricato) -> scarica tutto
    if (currAttacker?.attackLoaded) {
      // assicuriamoci di aggiornare anche il contesto esterno
      setAttackLoaded(false);
      return machinesReset;
    }

    // se val è falsy (es. ""), consideralo come request di unload
    if (!val) {
      setAttackLoaded(false);
      return machinesReset;
    }

    // estrai attackerDomain e targets puliti (usando la tua funzione esistente)
    const attackerDomain = currAttacker?.interfaces?.if?.[0]?.eth?.domain;
    const cleanIps = extractTargetIPs(targets, attackerDomain); // targets viene dal componente

    // prendi definizione dell'attacco
    const attackDef = getAttackDefinition ? getAttackDefinition(val) : null;
    const scriptPath = attackDef?.script || "/usr/local/bin/script.sh";
    const entrypoint = attackDef?.entrypoint || null;
    const params = attackDef?.parameters || {};

    // funzione d'aiuto per normalizzare params (accetta array o stringa)
    const normalizeParamTokens = (p) => {
      if (!p) return [];
      if (Array.isArray(p)) return p.map(String);
      // se è stringa, split su whitespace (es "-p 22,80 --flag")
      if (typeof p === 'string') return (p.match(/\S+/g) || []).map(String);
      return [String(p)];
    };

    const before = normalizeParamTokens(params.argsBeforeTargets);
    const after  = normalizeParamTokens(params.argsAfterTargets);

    // costruiamo l'array di token in modo sicuro:
    // [ entrypoint? , scriptPath, ...before, ...targets, ...after ]
    const args = [];

    if (entrypoint) args.push(String(entrypoint));
    args.push(String(scriptPath));

    for (const token of before) args.push(String(token));

    for (const ip of cleanIps) args.push(String(ip));

    for (const token of after) args.push(String(token));

    // build string leggibile
    const attackCommandStr = args.join(' ');

    // aggiorna solo il machine attackerIndex con le info dell'attacco caricato
    machinesReset[attackerIndex] = {
      ...machinesReset[attackerIndex],
      name: val,                     // qui salvi l'identificativo immagine/nome attacco
      targets: cleanIps,
      attackLoaded: true,
      attackImage: val,
      attackCommandArgs: args,       // array di token pronto per il main
      attackCommand: attackCommandStr,
    };

    // aggiorna anche il context locale/global
    setAttackLoaded(true);

    return machinesReset;
  });
};

    /*const toggleAttack = (val) => {
        setMachines(machines.map((m) => {
            if (m.type === "attacker"){
                if (!attacker.attackLoaded){
                    setAttackLoaded(true)
                    return {
                        ...m,
                        name: val,
                        targets: targets,
                        attackLoaded: true,
                        attackImage: val,
                        attackCommand: "sh /usr/local/bin/script.sh " + targets.map((t) => t.interfaces.if.filter((i) =>
                            i.eth.domain === attacker.interfaces.if[0].eth.domain
                        ).map((i) => i.ip.split("/")[0])).join(" ")
                    }
                } else {
                    setAttackLoaded(false)
                    return {
                        ...m,
                        targets: [],
                        attackLoaded: false,
                        attackImage: "",
                        attackCommand: ""
                    }
                }
            } else {
                return m
            }
        }))
    }*/

    return (
        <div className="flex flex-col auto-rows-max gap-2">
            <div className="grid items-start">
                <Button isLoading={isLoading} className="bg-secondary" startContent={isLoading ? null : <FaArrowRotateLeft />} onClick={handleRefresh}>{isLoading ? "Refreshing images..." : "Refresh images"}</Button>
            </div>
            <div className="flex-grow">
                <div className="grid gap-2">
                    <MachineSelector machines={machines} setTargets={setTargets} attacker={attacker} />
                    <AttackSelector type="Reconnaissance" attacker={attacker} attacks={attacks} selectedImage={selectedImage} setSelectedImage={setSelectedImage} isLoading={isLoading} handleRefresh={handleRefresh}/>
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

export default Reconnaissance;
