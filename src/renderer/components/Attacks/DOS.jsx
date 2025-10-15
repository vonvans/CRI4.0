import { Card, CardBody, Input } from "@nextui-org/react";
import { Radio, RadioGroup } from "@nextui-org/react";
import { CheckboxGroup, Checkbox } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { useState, useEffect } from "react";
import { FaWrench } from "react-icons/fa6";
import { FaArrowRotateLeft } from "react-icons/fa6";
import { useContext } from "react";
import { NotificationContext } from "../../contexts/NotificationContext";
import { XSymbol } from "../Symbols/XSymbol";
import { LogContext } from "../../contexts/LogContext";
import MachineSelector from "./MachineSelector";
import AttackSelector from "./AttackSelector";
import { attacksModel } from "../../models/model";

function DOS({attacker, attacks, isLoading, machines, setMachines, handleRefresh}) {

  const [selectedImage, setSelectedImage] = useState(attacker?.attackImage || "");
  const { attackLoaded, setAttackLoaded } = useContext(NotificationContext);
  const [targets, setTargets] = useState(attacker?.targets || []);
  const [extraText, setExtraText] = useState("");

  // --- New states for icmp-ping params ---
  // --- New states for icmp-ping params ---
  const [pingTimeoutEnabled, setPingTimeoutEnabled] = useState(false);
  const [pingTimeoutValue, setPingTimeoutValue] = useState("1"); // default 1s
  

  // ICMP only
const [icmpCodeEnabled, setIcmpCodeEnabled] = useState(false);
const [icmpCodeValue, setIcmpCodeValue] = useState("0"); // default 0

// SYN/UDP only
const [basePortEnabled, setBasePortEnabled] = useState(false);
const [basePortValue, setBasePortValue] = useState("");
const [destPortEnabled, setDestPortEnabled] = useState(false);
const [destPortValue, setDestPortValue] = useState("");

  const [pingAEnabled, setPingAEnabled] = useState(false); // corresponds to "-a" flag (off by default)
  const [pingAText, setPingAText] = useState(""); // value for -a (if enabled)

  // pinglite: -c (count) e velocità esclusiva --fast/--faster
const [liteCountEnabled, setLiteCountEnabled] = useState(false);
const [liteCountValue, setLiteCountValue]     = useState("100");
const [speedMode, setSpeedMode]               = useState(null); // 'fast' | 'faster' | null

 // --- Varianti ping ---
// flood: come ora
const DOS_FLOOD = new Set(["icmp-flood", "syn-flood", "udp-flood"]);
// lite: nuove
const DOS_LITE  = new Set(["icmp-floodlite", "syn-floodlite", "udp-floodlite"]);
// tutte
const DOS_ALL   = new Set([...DOS_FLOOD, ...DOS_LITE]);

const isIcmpKey = (k) => k.includes("icmp");
const isSynKey  = (k) => k.includes("syn");
const isUdpKey  = (k) => k.includes("udp");

// mapping di base (prima degli IP). flood conserva --flood; lite NO flood.
const PING_BEFORE_TOKENS_BY_NAME = {
  // flood
  "icmp-flood": ["-1", "--flood"],
  "syn-flood":  ["-S", "--flood"],
  "udp-flood":  ["-2", "--flood"],

  // lite (no flood)
  "icmp-floodlite": ["-1"],
  "syn-floodlite":  ["-S"],
  "udp-floodlite":  ["-2"],
};

  // salva temporaneamente argsAfterTargets prima di sovrascriverli per "whole-subnet"
  const [arpPrevArgsAfter, setArpPrevArgsAfter] = useState(null);

  useEffect(() => {
    // aggiorna selectedImage/targets quando cambia l'attacker
    setSelectedImage(attacker?.attackImage || "");
    setTargets(attacker?.targets || []);
  }, [attacker]);

    useEffect(() => {
    const def = getAttackDefinition(selectedImage);
    if (def && def.parameters) {
      const after = def.parameters.argsAfterTargets;
      if (Array.isArray(after) && after.length) {
        setExtraText(after.join(' '));

        // se è icmp-ping, parse dei parametri (compatibile con la logica Reconnaissance)
        if (DOS_ALL.has(def.name)) {
          const afterAll = Array.isArray(def.parameters.argsAfterTargets)
            ? def.parameters.argsAfterTargets.map(String)
            : (typeof def.parameters.argsAfterTargets === "string"
                ? (def.parameters.argsAfterTargets.match(/\S+/g) || [])
                : []);

          // defaults
          let toOn = false, toVal = "1";
          let aOn = false, aVal = "";

          // parsing: se -a è presente e ha un valore lo take next token (se esiste)
          for (let i = 0; i < afterAll.length; i++) {
            const t = afterAll[i];
            if (t === "--timeout") {
              const v = afterAll[i+1];
              if (v && !isNaN(parseFloat(v))) { toOn = true; toVal = String(v); i++; }
              else { toOn = true; toVal = "1"; }
            } else if (t === "-a") {
              // se next token esiste e non è un altro flag, prendilo come valore
              const v = afterAll[i+1];
              if (v && !v.startsWith("-")) { aOn = true; aVal = String(v); i++; }
              else { aOn = true; aVal = ""; } // -a without value -> keep empty
            }
          }

          setPingTimeoutEnabled(toOn);
          setPingTimeoutValue(toVal);
          setPingAEnabled(aOn);
          setPingAText(aVal);

          // non fare preview live: non ricostruire args qui (solo stato)
          // setExtraText(preview) lo lasciamo solo come visuale, ma non necessario
        }
      }
    } else {
      setExtraText("");
      setPingTimeoutEnabled(false);
      setPingTimeoutValue("1");
      setPingAEnabled(false);
      setPingAText("");
    }
  }, [selectedImage, attacks]);

  // split solo su spazi (mantiene virgole all'interno dei token)
  const tokenize = (s) => {
    if (!s) return [];
    return (String(s).match(/\S+/g) || []).map(String);
  };

  function updateAttackArgsBefore(attackName, tokens) {
    let updated = false;
    if (Array.isArray(attacks)) {
      const a = attacks.find(x =>
        x.name === attackName || x.image === attackName || x.displayName === attackName
      );
      if (a) {
        a.parameters = a.parameters || {};
        a.parameters.argsBeforeTargets = Array.isArray(tokens) ? tokens : tokenize(String(tokens));
        updated = true;
      }
    }
    try {
      if (typeof attacksModel !== "undefined") {
        const b = attacksModel.find(x =>
          x.name === attackName || x.image === attackName || x.displayName === attackName
        );
        if (b) {
          b.parameters = b.parameters || {};
          b.parameters.argsBeforeTargets = Array.isArray(tokens) ? tokens : tokenize(String(tokens));
          updated = true;
        }
      }
    } catch {}
    if (!updated) console.warn("updateAttackArgsBefore: attack not found:", attackName);

    // ricostruisci comando se attivo
    try {
      setMachines((prev) => {
        const idx = prev.findIndex(m => m.type === "attacker");
        if (idx === -1) return prev;
        const m = prev[idx];
        if (!m.attackLoaded) return prev;
        if ((m.attackImage || "") !== attackName) return prev;

        const def = getAttackDefinition(attackName);
        if (!def) return prev;

        const scriptPath = def?.script || "/usr/local/bin/script.sh";
        const entrypoint = def?.entrypoint || null;
        const params = def?.parameters || {};
        const before = Array.isArray(params.argsBeforeTargets)
          ? params.argsBeforeTargets.map(String)
          : (typeof params.argsBeforeTargets === "string" ? tokenize(params.argsBeforeTargets) : []);
        const after = Array.isArray(params.argsAfterTargets)
          ? params.argsAfterTargets.map(String)
          : (typeof params.argsAfterTargets === "string" ? tokenize(params.argsAfterTargets) : []);

        const attackerDomain = m?.interfaces?.if?.[0]?.eth?.domain;
        const cleanIps = extractTargetIPs(targets, attackerDomain, { allowOtherDomains: true });

        const newArgs = [];
        if (entrypoint) newArgs.push(String(entrypoint));
        newArgs.push(String(scriptPath));
        for (const t of before) newArgs.push(String(t));
        for (const ip of cleanIps) newArgs.push(String(ip));
        for (const t of after) newArgs.push(String(t));

        const cmdStr = newArgs.join(" ");
        const next = prev.slice();
        next[idx] = { ...m, targets: cleanIps, attackCommandArgs: newArgs, attackCommand: cmdStr };
        return next;
      });
    } catch (e) {
      console.warn("Failed to rebuild command after BEFORE update:", e);
    }
  }

  function updateAttackArgsAfter(attackName, tokens) {
    let updated = false;
    if (Array.isArray(attacks)) {
      const a = attacks.find(x => x.name === attackName || x.image === attackName || x.displayName === attackName);
      if (a) {
        a.parameters = a.parameters || {};
        a.parameters.argsAfterTargets = Array.isArray(tokens) ? tokens : tokenize(String(tokens));
        updated = true;
      }
    }
    try {
      if (typeof attacksModel !== "undefined") {
        const b = attacksModel.find(x => x.name === attackName || x.image === attackName || x.displayName === attackName);
        if (b) {
          b.parameters = b.parameters || {};
          b.parameters.argsAfterTargets = Array.isArray(tokens) ? tokens : tokenize(String(tokens));
          updated = true;
        }
      }
    } catch (e) {}
    if (!updated) {
      console.warn("updateAttackArgsAfter: attack not found:", attackName);
    }

    // se l'attacco è caricato sull'attacker, ricalcola attackCommandArgs per il machine
    try {
      setMachines((prevMachines) => {
        const idx = prevMachines.findIndex(m => m.type === "attacker");
        if (idx === -1) return prevMachines;
        const m = prevMachines[idx];
        if (!m.attackLoaded) return prevMachines;
        if ((m.attackImage || "") !== attackName) return prevMachines;

        const attackDef = getAttackDefinition(attackName);
        if (!attackDef) return prevMachines;

        const scriptPath = attackDef?.script || "/usr/local/bin/script.sh";
        const entrypoint = attackDef?.entrypoint || null;
        const params = attackDef?.parameters || {};
        const before = Array.isArray(params.argsBeforeTargets) ? params.argsBeforeTargets.map(String) : (typeof params.argsBeforeTargets === "string" ? tokenize(params.argsBeforeTargets) : []);
        const after = Array.isArray(params.argsAfterTargets) ? params.argsAfterTargets.map(String) : (typeof params.argsAfterTargets === "string" ? tokenize(params.argsAfterTargets) : []);

        const attackerDomain = m?.interfaces?.if?.[0]?.eth?.domain;
        const cleanIps = extractTargetIPs(targets, attackerDomain, { allowOtherDomains: true });

        const newArgs = [];
        if (entrypoint) newArgs.push(String(entrypoint));
        newArgs.push(String(scriptPath));
        for (const t of before) newArgs.push(String(t));
        for (const ip of cleanIps) newArgs.push(String(ip));
        for (const t of after) newArgs.push(String(t));

        const newCmdStr = newArgs.join(" ");
        const newMachines = prevMachines.slice();
        newMachines[idx] = {
          ...m,
          targets: cleanIps,
          attackCommandArgs: newArgs,
          attackCommand: newCmdStr,
          attackImage: attackName,
          attackLoaded: true,
        };
        return newMachines;
      });
    } catch (e) {
      console.warn("Failed to update attacker command args after changing params:", e);
    }
  }



function getPingBeforeTokens(defName, opts = {}) {
  const {
    aEnabled = false, aText = "",
    isLite = false,
    countEnabled = false, countValue = "10",
    speed = null, // 'fast' | 'faster' | null

    // nuovi
    icmpCodeEnabled = false, icmpCodeValue = "0",
    basePortEnabled = false, basePortValue = "",
    destPortEnabled = false, destPortValue = "",
  } = opts;

  const base = PING_BEFORE_TOKENS_BY_NAME[defName] || PING_BEFORE_TOKENS_BY_NAME["icmp-flood"];
  const before = [...base];

  // ---- LITE extra ----
  if (isLite) {
    if (speed === "fast")   before.push("--fast");
    if (speed === "faster") before.push("--faster");
      // se -c è selezionato → usa il valore scelto
  // se non è selezionato → imposta comunque -c 100
  const effectiveCount = countEnabled ? String(countValue || "10") : "100";
  before.push("-c", effectiveCount);
  }

  // ---- ICMP only ----
  if (isIcmpKey(defName) && icmpCodeEnabled) {
    const v = String(icmpCodeValue ?? "").trim();
    if (v !== "") before.push("--icmpcode", v);
  }

  // ---- SYN/UDP only ----
  if (!isIcmpKey(defName)) {
    if (basePortEnabled) {
      const v = String(basePortValue ?? "").trim();
      if (v !== "") before.push("--baseport", v);
    }
    if (destPortEnabled) {
      const v = String(destPortValue ?? "").trim();
      if (v !== "") before.push("--destport", v);
    }
  }

  // ---- -a comune ----
  if (aEnabled) {
    if (String(aText || "").trim()) before.push("-a", String(aText).trim());
    else before.push("-a");
  }

  return before;
}

function pingMapKeyForImage(imageName) {
  if (!imageName) return "icmp-flood";
  if (PING_BEFORE_TOKENS_BY_NAME[imageName]) return imageName;

  const short = String(imageName).split("/").pop();
  if (PING_BEFORE_TOKENS_BY_NAME[short]) return short;

  if (short.includes("syn"))  return short.includes("lite") ? "syn-floodlite"  : "syn-flood";
  if (short.includes("udp"))  return short.includes("lite") ? "udp-floodlite"  : "udp-flood";
  if (short.includes("icmp")) return short.includes("lite") ? "icmp-floodlite" : "icmp-flood";

  return "icmp-flood";
}

function getPingKey(attackDef, selectedImage, requestedImage) {
  const raw = requestedImage || selectedImage || (attackDef?.name || "");
  return pingMapKeyForImage(raw);
}
  
 const clampPort = (p) => {
  const n = Number(p);
  return Number.isFinite(n) ? Math.max(0, Math.min(65535, n)) : "";
};

const rebuildPingArgs = (imageName) => {
  if (!imageName) return;

  const mapKey = getPingKey(getAttackDefinition(imageName), selectedImage, imageName);
  const isLite = DOS_LITE.has(mapKey);
 

  const beforeTokens = getPingBeforeTokens(mapKey, {
    aEnabled: pingAEnabled,
    aText: pingAText,
    isLite,
    countEnabled: liteCountEnabled,
    countValue: liteCountValue,
    speed: speedMode,

    // nuovi
    icmpCodeEnabled,
    icmpCodeValue,
    basePortEnabled,
    basePortValue: clampPort(basePortValue),
    destPortEnabled,
    destPortValue: clampPort(destPortValue),
  });

  updateAttackArgsBefore(imageName, beforeTokens);
  updateAttackArgsAfter(imageName, []); // nessun after
  setExtraText(beforeTokens.join(" "));
};

   // rebuild helper for icmp-ping
  // rebuild helper for icmp-ping — hardcode -1 and --flood into argsBeforeTargets

/*
const rebuildPingArgs = (imageName) => {
  if (!imageName) return;

  // prende i token base (prima degli IP) dalla mappa; fallback all’icmp
  const baseBefore = PING_BEFORE_TOKENS_BY_NAME[imageName] 
    || PING_BEFORE_TOKENS_BY_NAME["icmp-ping"];

  // ALWAYS include these two BEFORE the IPs
  const beforeTokens = [...baseBefore];

  // add -a user option (se abilitato)
  if (pingAEnabled) {
    if (String(pingAText || "").trim() !== "") {
      beforeTokens.push("-a", String(pingAText).trim());
    } else {
      beforeTokens.push("-a");
    }
  }

  // AFTER tokens: shell snippet to kill after timeout (user decides)
  const afterTokens = [];
  if (pingTimeoutEnabled) {
    const sleepVal = String(pingTimeoutValue || "1").trim();
    const snippet = [
      "&",
      "pid=$!",
      `sleep ${sleepVal}`,
      'kill -TERM "$pid"',
      'wait "$pid" 2>/dev/null'
    ].join("\n");
    
    const snippet = [];

    //afterTokens.push(snippet);
  }
  

  // Scrivi i tokens runtime nel modello (argsBeforeTargets deve contenere i beforeTokens)
  updateAttackArgsBefore(imageName, beforeTokens);
  updateAttackArgsAfter(imageName, afterTokens);

  // opzionale: mostra una preview sintetica in UI
  setExtraText(
    beforeTokens.join(" ") +
      (afterTokens.length ? " [shell-snippet]" : "")
  );
};
*/
  const onExtraTextChange = (ev) => {
    const val = ev.target.value;
    setExtraText(val);
    if (!selectedImage) return;
    const tokens = tokenize(val);
    updateAttackArgsAfter(selectedImage, tokens);
  };

  const onPingTimeoutToggle = (checked) => {
    setPingTimeoutEnabled(Boolean(checked));
    setPingTimeoutValue(pingTimeoutValue || "1");
    // no rebuild qui: aspettiamo che l'utente prema Load Attack
  };
  const onPingTimeoutValueChange = (e) => {
    const v = e?.target?.value ?? "";
    setPingTimeoutValue(v);
    // no rebuild here
  };
 const onPingAToggle = (checked) => {
  setPingAEnabled(Boolean(checked));
  //if (!checked && selectedImage) {
    // rimuove subito -a dal BEFORE per icmp-ping
    //updateAttackArgsBefore(selectedImage, []);
  //}
    if (selectedImage) {
    // ricostruisce i BEFORE mantenendo sempre -1 --flood,
    // ed eventualmente aggiunge/rimuove -a [val]
    rebuildPingArgs(selectedImage);
  }
};

    const onPingATextChange = (e) => {
    const v = e?.target?.value ?? "";
    setPingAText(v);
    // non ricostruire automaticamente (l'utente vuole che i param passino SOLO al click Load Attack)
    // tuttavia manteniamo la possibilità di ricostruire lo stato se vuoi:
    // if (pingAEnabled) rebuildPingArgs(selectedImage);
  };

  // helper ip/subnet utilities (same as in Recon)
  const ipRegex = /^(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\.(?:25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/;
  function computeSubnetFromIp(rawIp) {
    if (!rawIp) return null;
    if (String(rawIp).includes("/")) {
      try { return String(rawIp).trim(); } catch (e) { return null; }
    }
    const ipOnly = String(rawIp).split("/")[0].trim();
    const oct = ipOnly.split(".");
    if (oct.length === 4) return `${oct[0]}.${oct[1]}.${oct[2]}.0/24`;
    return null;
  }

  useEffect(() => {
    setArpPrevArgsAfter(null);
  }, [selectedImage]);
/*
  function extractTargetIPs(targets = [], attackerDomain) {
    const ips = [];
    targets.forEach((t) => {
      if (!t || !t.interfaces || !Array.isArray(t.interfaces.if)) return;
      t.interfaces.if.forEach((iface) => {
        try {
          if (iface && iface.eth && iface.eth.domain === attackerDomain && iface.ip) {
            const ipOnly = String(iface.ip).split('/')[0].trim();
            if (ipRegex.test(ipOnly)) ips.push(ipOnly);
          }
        } catch (e) {}
      });
    });
    return Array.from(new Set(ips));
  }
    */


  // PING.jsx
function extractTargetIPs(
  targets = [],
  attackerDomain,
  { allowOtherDomains = true } = {}  // default: includi anche altre subnet
) {
  const ips = [];
  targets.forEach((t) => {
    if (!t || !t.interfaces || !Array.isArray(t.interfaces.if)) return;

    t.interfaces.if.forEach((iface) => {
      try {
        if (!iface || !iface.eth || !iface.ip) return;

        // Se allowOtherDomains è true, non filtrare per dominio
        const sameDomain = iface.eth.domain === attackerDomain;
        if ((allowOtherDomains || sameDomain)) {
          const ipOnly = String(iface.ip).split('/')[0].trim();
          if (ipRegex.test(ipOnly)) ips.push(ipOnly);
        }
      } catch {}
    });
  });
  return Array.from(new Set(ips));
}

  // helper: trova definizione attacco
  function getAttackDefinition(attackName) {
    if (!Array.isArray(attacks)) return null;
    return attacks.find(a => a.name === attackName || a.image === attackName || a.displayName === attackName) || null;
  }

function resetAllParamStates() {
  setExtraText("");
  setPingTimeoutEnabled(false);
  setPingTimeoutValue("1");
  setPingAEnabled(false);
  setPingAText("");
  setLiteCountEnabled(false);
setLiteCountValue("10");
setSpeedMode(null);
setIcmpCodeEnabled(false);
setIcmpCodeValue("0");
setBasePortEnabled(false);
setBasePortValue("");
setDestPortEnabled(false);
setDestPortValue("");

  // svuota i parametri nel modello per l’attacco corrente
  if (selectedImage) {
    try { updateAttackArgsBefore(selectedImage, []); } catch {}
    try { updateAttackArgsAfter(selectedImage, []); } catch {}
  }
}


function clearAllAttackParamsExcept(keepName) {
  if (!Array.isArray(attacks)) return;
  for (const a of attacks) {
    const isKeep =
      a.name === keepName || a.image === keepName || a.displayName === keepName;
    if (!a.parameters) a.parameters = {};
    if (!isKeep) {
      a.parameters.argsBeforeTargets = [];
      a.parameters.argsAfterTargets = [];
    }
  }
  // opzionale: fai lo stesso su attacksModel se lo usi come fallback
  try {
    if (typeof attacksModel !== "undefined") {
      for (const b of attacksModel) {
        const isKeep =
          b.name === keepName || b.image === keepName || b.displayName === keepName;
        b.parameters = b.parameters || {};
        if (!isKeep) {
          b.parameters.argsBeforeTargets = [];
          b.parameters.argsAfterTargets = [];
        }
      }
    }
  } catch {}
}

  // toggleAttack (identico comportamento a Reconnaissance, adattato)
  const toggleAttack = (val) => {
    const requestedImage = val;
    // pulisci parametri di tutti gli altri attacchi prima di (ri)caricare il nuovo
clearAllAttackParamsExcept(requestedImage);
    try {
      /*
      const def = getAttackDefinition(requestedImage);
      if (def && PING_VARIANTS.has(def.name)) {
        rebuildPingArgs(requestedImage);
      }
        */
       const def = getAttackDefinition(requestedImage);
if (def) {
  rebuildPingArgs(def.name || requestedImage);
}
    } catch (e) {
      console.warn("pre-rebuildPingArgs failed:", e);
    }

    setMachines((prevMachines) => {
      const attackerIndex = prevMachines.findIndex(m => m.type === "attacker");
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
      if (attackerIndex === -1) return machinesReset;
      const currAttacker = prevMachines[attackerIndex];

      if (currAttacker?.attackLoaded) {
        try {
          const currName = currAttacker?.attackImage || selectedImage || null;
          if (currName) {
            try { updateAttackArgsBefore(currName, []); } catch (e) {}
            try { updateAttackArgsAfter(currName, []); } catch (e) {}
          }
        } catch (e) {}
        resetAllParamStates();
        setAttackLoaded(false);
        return machinesReset;
      }

      if (!val) {
        try {
          const currName = selectedImage || null;
          if (currName) {
            try { updateAttackArgsBefore(currName, []); } catch (e) {}
            try { updateAttackArgsAfter(currName, []); } catch (e) {}
          }
        } catch (e) {}
        resetAllParamStates();
        setAttackLoaded(false);
        return machinesReset;
      }

      const attackerDomain = currAttacker?.interfaces?.if?.[0]?.eth?.domain;
      const cleanIps = extractTargetIPs(targets, attackerDomain, { allowOtherDomains: true });

      const attackDef = getAttackDefinition ? getAttackDefinition(val) : null;
      const scriptPath = attackDef?.script || "/usr/local/bin/script.sh";
      const entrypoint = attackDef?.entrypoint || null;
 const params = attackDef?.parameters || {};

const normalizeParamTokens = (p) => {
  if (!p) return [];
  if (Array.isArray(p)) return p.map(String);
  if (typeof p === 'string') return (p.match(/\S+/g) || []).map(String);
  return [String(p)];
};

// 🔑 prendi la chiave normalizzata per le varianti di ping
const pingKey = getPingKey(attackDef, selectedImage, val);

let before;
if (DOS_ALL.has(pingKey)) {
  before = getPingBeforeTokens(pingKey, {
    aEnabled: pingAEnabled,
    aText: pingAText,
    isLite: DOS_LITE.has(pingKey),
    countEnabled: liteCountEnabled,
    countValue: liteCountValue,
    speed: speedMode,

    icmpCodeEnabled,
    icmpCodeValue,
    basePortEnabled,
    basePortValue,
    destPortEnabled,
    destPortValue,
  });
} else {
  before = normalizeParamTokens(params.argsBeforeTargets);
}

let after = normalizeParamTokens(params.argsAfterTargets);
if (attackDef?.name === "port-scanning") after = [];

// (opzionale per debug)
console.log("PING KEY:", pingKey, "BEFORE TOKENS:", before);

      const args = [];
      if (entrypoint) args.push(String(entrypoint));
      args.push(String(scriptPath));
      for (const token of before) args.push(String(token));
      for (const ip of cleanIps) args.push(String(ip));
      for (const token of after) args.push(String(token));

      const attackCommandStr = args.join(' ');

      machinesReset[attackerIndex] = {
        ...machinesReset[attackerIndex],
        name: val,
        targets: cleanIps,
        attackLoaded: true,
        attackImage: val,
        attackCommandArgs: args,
        attackCommand: attackCommandStr,
      };

      setAttackLoaded(true);
      return machinesReset;
    });

    try {
      const def = getAttackDefinition(requestedImage);
      if (!def) return;
      // If specific rebuild needed for ping attack, call rebuildPingArgs
      if (DOS_ALL.has(def.name)) {
        rebuildPingArgs(requestedImage);
      }
    } catch (e) {
      console.warn("toggleAttack post-rebuild failed:", e);
    }
  };

  return (
    <div className="flex flex-col auto-rows-max gap-2">
      <div className="grid items-start">
        <Button isLoading={isLoading} className="bg-secondary" startContent={isLoading ? null : <FaArrowRotateLeft />} onClick={handleRefresh}>
          {isLoading ? "Refreshing images..." : "Refresh images"}
        </Button>
      </div>

      <div className="flex-grow">
        <div className="grid gap-2">
          <MachineSelector machines={machines} setTargets={setTargets} attacker={attacker} />
          <AttackSelector type="dos" attacker={attacker} attacks={attacks} selectedImage={selectedImage} setSelectedImage={setSelectedImage} isLoading={isLoading} handleRefresh={handleRefresh}/>
        </div>
      </div>

      <div className="grid gap-2">
        {selectedImage ? (
          (() => {
            const def = getAttackDefinition(selectedImage);
            if (!def) return <div className="text-xs text-foreground">Selected attack definition not found.</div>;

            // se è il ping icmp-ping mostra la UI specifica (timeout + -a)
            if (DOS_ALL.has(def.name)) {
  const isLite = DOS_LITE.has(def.name);

  return (
    <div className="grid gap-3">
      {/* -a comune (anche ai lite) */}
      <div className="flex items-center gap-3">
        <Checkbox isSelected={pingAEnabled} onValueChange={(v)=>{ setPingAEnabled(Boolean(v)); if (selectedImage) rebuildPingArgs(selectedImage); }}>
          <span className="font-mono text-xs">-a (spoofed IP)</span>
        </Checkbox>
        <Input
          type="text"
          label="value"
          size="sm"
          value={pingAText}
          onChange={(e)=>{ setPingAText(e?.target?.value ?? ""); }}
          onBlur={()=>{ if (selectedImage) rebuildPingArgs(selectedImage); }}
          isDisabled={!pingAEnabled}
          className="max-w-[220px]"
          placeholder="192.168.X.X"
        />
      </div>
      {/* ICMP CODE */}
<div className="flex items-end gap-3">
  <Checkbox
    isSelected={icmpCodeEnabled}
    isDisabled={!isIcmpKey(def.name)}
    onValueChange={(v)=>{ setIcmpCodeEnabled(Boolean(v)); if (selectedImage) rebuildPingArgs(selectedImage); }}
  >
    <span className="font-mono text-xs">--icmpcode</span>
  </Checkbox>

  {/* un semplice <select> con alcuni valori tipici; puoi estendere la lista */}
  <select
    className="border rounded px-2 py-1 text-sm"
    disabled={!icmpCodeEnabled || !isIcmpKey(def.name)}
    value={icmpCodeValue}
    onChange={(e)=>{ setIcmpCodeValue(e.target.value); if (selectedImage) rebuildPingArgs(selectedImage); }}
  >
    {["0","1","2","3","4","5","8","11","12","13","14","15"].map(c => (
      <option key={c} value={c}>{c}</option>
    ))}
  </select>

  <div className="text-xs text-muted">
    Active only for ICMP.
  </div>
</div>
{/* BASEPORT / DESTPORT */}
<div className="flex flex-wrap items-end gap-4">
  <div className="flex items-end gap-2">
    <Checkbox
      isSelected={basePortEnabled}
      isDisabled={isIcmpKey(def.name)}
      onValueChange={(v)=>{ setBasePortEnabled(Boolean(v)); if (selectedImage) rebuildPingArgs(selectedImage); }}
    >
      <span className="font-mono text-xs">baseport</span>
    </Checkbox>
    <Input
      type="number"
      min={0}
      max={65535}
      size="sm"
      label="value"
      value={basePortValue}
      onChange={(e)=> setBasePortValue(e?.target?.value ?? "")}
      onBlur={()=>{ if (selectedImage) rebuildPingArgs(selectedImage); }}
      isDisabled={!basePortEnabled || isIcmpKey(def.name)}
      className="max-w-[120px]"
    />
  </div>

  <div className="flex items-end gap-2">
    <Checkbox
      isSelected={destPortEnabled}
      isDisabled={isIcmpKey(def.name)}
      onValueChange={(v)=>{ setDestPortEnabled(Boolean(v)); if (selectedImage) rebuildPingArgs(selectedImage); }}
    >
      <span className="font-mono text-xs">destport</span>
    </Checkbox>
    <Input
      type="number"
      min={0}
      max={65535}
      size="sm"
      label="value"
      value={destPortValue}
      onChange={(e)=> setDestPortValue(e?.target?.value ?? "")}
      onBlur={()=>{ if (selectedImage) rebuildPingArgs(selectedImage); }}
      isDisabled={!destPortEnabled || isIcmpKey(def.name)}
      className="max-w-[120px]"
    />
  </div>

  <div className="text-xs text-muted">
    Actives only for SYN/UDP.
  </div>
</div>

      {/* Se LITE: -c e fast/faster */}
      {isLite && (
        <>
          <div className="flex items-end gap-3">
            <Checkbox
              isSelected={liteCountEnabled}
              onValueChange={(v)=>{ setLiteCountEnabled(Boolean(v)); if (selectedImage) rebuildPingArgs(selectedImage); }}
            >
              <span className="font-mono text-xs">-c (number of sent packets)</span>
            </Checkbox>
            <Input
              type="number"
              min={1}
              step={1}
              label="packets"
              size="sm"
              value={liteCountValue}
              onChange={(e)=> setLiteCountValue(e?.target?.value ?? "10")}
              onBlur={()=>{ if (selectedImage) rebuildPingArgs(selectedImage); }}
              isDisabled={!liteCountEnabled}
              className="max-w-[140px]"
            />
          </div>

          <div className="flex items-center gap-6">
            <Checkbox
              isSelected={speedMode === "fast"}
              onValueChange={(v)=>{
                const next = v ? "fast" : (speedMode === "fast" ? null : speedMode);
                setSpeedMode(next);
                if (selectedImage) rebuildPingArgs(selectedImage);
              }}
            >
              <span className="font-mono text-xs">--fast</span>
            </Checkbox>

            <Checkbox
              isSelected={speedMode === "faster"}
              onValueChange={(v)=>{
                const next = v ? "faster" : (speedMode === "faster" ? null : speedMode);
                setSpeedMode(next);
                if (selectedImage) rebuildPingArgs(selectedImage);
              }}
            >
              <span className="font-mono text-xs">--faster</span>
            </Checkbox>

            <div className="text-xs text-muted">Exclusive selection: choose between <code className="font-mono">--fast</code> (10 packets/second) and <code className="font-mono">--faster</code> (100 packets/second).</div>
          </div>
        </>
      )}

      {/* (Facoltativo) tuo messaggio timeout/flood */}
      {!isLite && (
        <div className="text-xs text-muted">
          In flood mode output is soppressed and the command is auto-terminated from main after 4 seconds.
        </div>
      )}
    </div>
  );
}

            // default: textbox generica per argsAfterTargets
            return (
              <div className="grid gap-1">
                <label className="text-xs">Params:</label>
                <input
                  type="text"
                  value={extraText}
                  onChange={onExtraTextChange}
                  placeholder="args after targets (space-separated)"
                  className="w-full border rounded p-2"
                />
                <div className="text-xs text-muted">Tokens separated by spaces. Example: <code className="font-mono">--timeout 1 --verbose</code></div>
              </div>
            );
          })()
        ) : (
          <div className="text-xs text-muted">Select an attack to edit parameters.</div>
        )}

        <Button
          isDisabled={selectedImage === ""}
          className={attacker?.attackLoaded ? "bg-primary" : "bg-success"}
          startContent={attacker?.attackLoaded && <XSymbol />}
          onClick={() => typeof toggleAttack === "function" ? toggleAttack(selectedImage) : console.warn("toggleAttack not defined")}
        >
          {attacker?.attackLoaded ? "Unload Attack" : "Load Attack"}
        </Button>
      </div>
    </div>
  );
}

export default DOS;