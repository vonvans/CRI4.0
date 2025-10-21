
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


function Reconnaissance({attacker, attacks, isLoading, machines, setMachines, handleRefresh}) {


    const [selectedImage, setSelectedImage] = useState(attacker?.attackImage || "");
const { attackLoaded, setAttackLoaded } = useContext(NotificationContext);
const [targets, setTargets] = useState(attacker?.targets || []);

    console.log(attacker?.attackImage)

    // textbox generale per params (argsAfterTargets)
const [extraText, setExtraText] = useState("");

// controllo numerico specifico per icmp-scanning
const [icmpWorkers, setIcmpWorkers] = useState(50);

// salva temporaneamente argsAfterTargets prima di sovrascriverli per "whole-subnet"
const [arpPrevArgsAfter, setArpPrevArgsAfter] = useState(null);

// ARP scanning UI state
const [arpMode, setArpMode] = useState("targets"); // "targets" | "whole-subnet"

// parametro selezionato via radio (per icmp-scanning al momento uno solo)
//const [selectedParam, setSelectedParam] = useState("--workers");

// ICMP params (indipendenti)
const [icmpWorkersEnabled, setIcmpWorkersEnabled] = useState(true);
const [icmpWorkersValue, setIcmpWorkersValue] = useState("50");

const [icmpTimeoutEnabled, setIcmpTimeoutEnabled] = useState(false);
const [icmpTimeoutValue, setIcmpTimeoutValue] = useState("1");

// flag verbose per icmp-scanning
const [icmpVerbose, setIcmpVerbose] = useState(false);

// --- PORT SCANNING UI STATE ---
const [portPortsEnabled, setPortPortsEnabled] = useState(true);
const [portPortsValue, setPortPortsValue] = useState("21,22,23,25,53,80,443,502");

const [portUdpEnabled, setPortUdpEnabled] = useState(false);

const [portTimeoutEnabled, setPortTimeoutEnabled] = useState(false);
const [portTimeoutValue, setPortTimeoutValue] = useState("1");

const [portWorkersEnabled, setPortWorkersEnabled] = useState(false);
const [portWorkersValue, setPortWorkersValue] = useState("200");

const [portVerboseEnabled, setPortVerboseEnabled] = useState(false);
const [portPortsWarning, setPortPortsWarning] = useState(null);

// --- OS fingerprinting UI state ---
const [osTimeoutEnabled, setOsTimeoutEnabled] = useState(false);
const [osTimeoutValue, setOsTimeoutValue] = useState("1");

const [osWorkersEnabled, setOsWorkersEnabled] = useState(false);
const [osWorkersValue, setOsWorkersValue] = useState("50");

const [osVerboseEnabled, setOsVerboseEnabled] = useState(false);


// --- SERVICE ENUMERATION UI STATE ---
const [svcPortsEnabled, setSvcPortsEnabled] = useState(true);
const [svcPortsValue, setSvcPortsValue] = useState("22,23,80,443,502,102,2404,44818,20000");

const [svcTimeoutEnabled, setSvcTimeoutEnabled] = useState(false);
const [svcTimeoutValue, setSvcTimeoutValue] = useState("1.0");

const [svcWorkersEnabled, setSvcWorkersEnabled] = useState(false);
const [svcWorkersValue, setSvcWorkersValue] = useState("100");



const [svcVerboseEnabled, setSvcVerboseEnabled] = useState(false);

const [svcPortsWarning, setSvcPortsWarning] = useState(null);

// valore del parametro scelto (testo libero)
//const [paramValue, setParamValue] = useState("50"); // default coerente con workers

useEffect(() => {
  // aggiorna selectedImage/targets quando cambia l'attacker
  setSelectedImage(attacker?.attackImage || "");
  setTargets(attacker?.targets || []);
}, [attacker]);

// quando cambia la selezione immagine, popola la text area con argsAfterTargets esistenti
useEffect(() => {
  const def = getAttackDefinition(selectedImage);
  if (def && def.parameters) {
    const after = def.parameters.argsAfterTargets;
    if (Array.isArray(after) && after.length) {
      setExtraText(after.join(' '));

      if (def.name === "icmp-scanning") {
  // ...sostituisci l’intero blocco di parsing ICMP con:
  const afterAll = Array.isArray(def.parameters.argsAfterTargets)
    ? def.parameters.argsAfterTargets.map(String)
    : (typeof def.parameters.argsAfterTargets === "string"
        ? (def.parameters.argsAfterTargets.match(/\S+/g) || [])
        : []);

  // reset default
  let workersOn = false, workersVal = "50";
  let timeoutOn = false, timeoutVal = "1";
  let verboseOn = false;

  // scan sequenziale tipo [--workers, 60, --timeout, 4, --verbose]
  for (let i = 0; i < afterAll.length; i++) {
    const t = afterAll[i];
    if (t === "--workers") {
      const v = afterAll[i + 1];
      if (v && !isNaN(parseInt(v, 10))) {
        workersOn = true; workersVal = String(v); i++;
      } else {
        workersOn = true; workersVal = "50";
      }
    } else if (t === "--timeout") {
      const v = afterAll[i + 1];
      if (v && !isNaN(parseFloat(v))) {
        timeoutOn = true; timeoutVal = String(v); i++;
      } else {
        timeoutOn = true; timeoutVal = "1";
      }
    } else if (t === "--verbose") {
      verboseOn = true;
    }
  }

  setIcmpWorkersEnabled(workersOn);
  setIcmpWorkersValue(workersVal);
  setIcmpTimeoutEnabled(timeoutOn);
  setIcmpTimeoutValue(timeoutVal);
  setIcmpVerbose(verboseOn);

  // per compat vecchia: mantieni icmpWorkers number
  const n = parseInt(workersVal, 10);
  if (!Number.isNaN(n)) setIcmpWorkers(n);

  // preview/debug
  const preview = [
    ...(workersOn ? ["--workers", workersVal] : []),
    ...(timeoutOn ? ["--timeout", timeoutVal] : []),
    ...(verboseOn ? ["--verbose"] : []),
  ].join(" ");
  setExtraText(preview);
}
      if (def.name === "arp-scanning") {
  const after = def.parameters.argsAfterTargets;
  if (Array.isArray(after) && after.length === 1) {
    // se è una singola voce che sembra una subnet -> setta whole-subnet
    const maybe = String(after[0]);
    if (maybe.includes("/")) {
      setArpMode("whole-subnet");
    } else {
      setArpMode("targets");
    }
    // non mostrare textbox per arp-scanning (gestito UI)
    setExtraText(""); // optional: pulisce la textbox UI per arp
  } else {
    setArpMode("targets");
  }
}
    } else {
      setExtraText("");
      if (def.name === "icmp-scanning") {
        // default multiparam
    setIcmpWorkersEnabled(true);
    setIcmpWorkersValue("50");
    setIcmpTimeoutEnabled(false);
    setIcmpTimeoutValue("1");
    setIcmpVerbose(false);
    setIcmpWorkers(50); // legacy sync, opzionale

    // aggiorna subito argsAfterTargets coerentemente ai default
    rebuildIcmpArgs(selectedImage);
      }

      if (def.name === "port-scanning") {
        // harden: per port-scanning, assicurati che argsAfterTargets sia vuoto
updateAttackArgsAfter(selectedImage, []);
  // leggi argsBeforeTargets
  const beforeAll = Array.isArray(def.parameters.argsBeforeTargets)
    ? def.parameters.argsBeforeTargets.map(String)
    : (typeof def.parameters.argsBeforeTargets === "string"
        ? (def.parameters.argsBeforeTargets.match(/\S+/g) || [])
        : []);

  // reset ai default UI
  let pOn = true, pVal = "21,22,23,25,53,80,443,502";
  let udpOn = false;
  let toOn = false, toVal = "1";
  let wkOn = false, wkVal = "200";
  let vbOn = false;

  // parse sequenziale: [-p, "list", --udp, --timeout, "v", --workers, "n", --verbose]
  for (let i = 0; i < beforeAll.length; i++) {
    const t = beforeAll[i];
    if (t === "-p" || t === "--ports") {
      const v = beforeAll[i + 1];
      if (v) { pOn = true; pVal = String(v); i++; }
    } else if (t === "--udp") {
      udpOn = true;
    } else if (t === "--timeout") {
      const v = beforeAll[i + 1];
      if (v) { toOn = true; toVal = String(v); i++; }
    } else if (t === "--workers") {
      const v = beforeAll[i + 1];
      if (v) { wkOn = true; wkVal = String(v); i++; }
    } else if (t === "--verbose") {
      vbOn = true;
    }
  }

  setPortPortsEnabled(pOn);
  setPortPortsValue(pVal);
  setPortUdpEnabled(udpOn);
  setPortTimeoutEnabled(toOn);
  setPortTimeoutValue(toVal);
  setPortWorkersEnabled(wkOn);
  setPortWorkersValue(wkVal);
  setPortVerboseEnabled(vbOn);

  // preview facoltativo
  const preview = [
    ...(pOn ? ["-p", pVal] : []),
    ...(udpOn ? ["--udp"] : []),
    ...(toOn ? ["--timeout", toVal] : []),
    ...(wkOn ? ["--workers", wkVal] : []),
    ...(vbOn ? ["--verbose"] : []),
  ].join(" ");
  // NB: è solo preview, non influisce sulla build del comando
  setExtraText(preview || "");
} 
if (def.name === "os-fingerprinting") {
  // read argsAfterTargets (options *after* targets for this script)
  const afterAll = Array.isArray(def.parameters.argsAfterTargets)
    ? def.parameters.argsAfterTargets.map(String)
    : (typeof def.parameters.argsAfterTargets === "string"
        ? (def.parameters.argsAfterTargets.match(/\S+/g) || [])
        : []);

  // defaults
  let toOn = false, toVal = "1";
  let wkOn = false, wkVal = "50";
  let vbOn = false;

  // parse sequenziale: [--timeout, "v", --workers, "n", --verbose]
  for (let i = 0; i < afterAll.length; i++) {
    const t = afterAll[i];
    if (t === "--timeout") {
      const v = afterAll[i + 1];
      if (v && !isNaN(parseFloat(v))) { toOn = true; toVal = String(v); i++; }
      else { toOn = true; toVal = "1"; }
    } else if (t === "--workers") {
      const v = afterAll[i + 1];
      if (v && !isNaN(parseInt(v, 10))) { wkOn = true; wkVal = String(v); i++; }
      else { wkOn = true; wkVal = "50"; }
    } else if (t === "--verbose") {
      vbOn = true;
    }
  }

  setOsTimeoutEnabled(toOn);
  setOsTimeoutValue(toVal);
  setOsWorkersEnabled(wkOn);
  setOsWorkersValue(wkVal);
  setOsVerboseEnabled(vbOn);

  // optional preview
  const preview = [
    ...(toOn ? ["--timeout", toVal] : []),
    ...(wkOn ? ["--workers", wkVal] : []),
    ...(vbOn ? ["--verbose"] : []),
  ].join(" ");
  setExtraText(preview);
}
if (def.name === "service-enumeration") {
  // assicurati che argsAfterTargets sia vuoto (usiamo argsBeforeTargets)
  updateAttackArgsAfter(selectedImage, []);

  const beforeAll = Array.isArray(def.parameters.argsBeforeTargets)
    ? def.parameters.argsBeforeTargets.map(String)
    : (typeof def.parameters.argsBeforeTargets === "string"
        ? (def.parameters.argsBeforeTargets.match(/\S+/g) || [])
        : []);

  // default UI
  let pOn = true, pVal = "22,23,80,443,502,102,2404,44818,20000";
  let toOn = false, toVal = "1.0";
  let wkOn = false, wkVal = "100";
  let vbOn = false;

  for (let i = 0; i < beforeAll.length; i++) {
    const t = beforeAll[i];
    if (t === "--ports" || t === "-p") {
      const v = beforeAll[i + 1];
      if (v) { pOn = true; pVal = String(v); i++; }
    } else if (t === "--timeout") {
      const v = beforeAll[i + 1];
      if (v) { toOn = true; toVal = String(v); i++; }
    } else if (t === "--workers") {
      const v = beforeAll[i + 1];
      if (v) { wkOn = true; wkVal = String(v); i++; }
    } else if (t === "--verbose") {
      vbOn = true;
    }
  }

  setSvcPortsEnabled(pOn);
  setSvcPortsValue(pVal);
  setSvcTimeoutEnabled(toOn);
  setSvcTimeoutValue(toVal);
  setSvcWorkersEnabled(wkOn);
  setSvcWorkersValue(wkVal);
  setSvcVerboseEnabled(vbOn);

  // preview (opzionale)
  const preview = [
    ...(pOn ? ["--ports", pVal] : []),
    ...(toOn ? ["--timeout", toVal] : []),
    ...(wkOn ? ["--workers", wkVal] : []),
    ...(vbOn ? ["--verbose"] : []),
  ].join(" ");
  setExtraText(preview || "");
}

else {
  // se cambi attacco, resetta port-scanning ai default "consigliati"
  setPortPortsEnabled(true);
  setPortPortsValue("21,22,23,25,53,80,443,502");
  setPortUdpEnabled(false);
  setPortTimeoutEnabled(false);
  setPortTimeoutValue("1");
  setPortWorkersEnabled(false);
  setPortWorkersValue("200");
  setPortVerboseEnabled(false);
}

    }
  } else {
    setExtraText("");
  }
}, [selectedImage, attacks]);

// split solo su spazi (mantiene virgole all'interno dei token)
const tokenize = (s) => {
  if (!s) return [];
  return (String(s).match(/\S+/g) || []).map(String);
};

function updateAttackArgsBefore(attackName, tokens) {
  let updated = false;

  // aggiorna in-place la lista attacks (se presente)
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

  // fallback: aggiorna anche attacksModel
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

  // se l'attacco è caricato, ricalcola attackCommandArgs
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

const rebuildSvcArgs = (imageName) => {
  if (!imageName) return;
  // costruisce i token leggendo gli state correnti
  const tokens = [];
  if (svcPortsEnabled) tokens.push("--ports", String(svcPortsValue || "22,23,80,443,502,102,2404,44818,20000"));
  if (svcTimeoutEnabled) tokens.push("--timeout", String(svcTimeoutValue || "1.0"));
  if (svcWorkersEnabled) tokens.push("--workers", String(svcWorkersValue || "100"));
  if (svcVerboseEnabled) tokens.push("--verbose");

  updateAttackArgsBefore(imageName, tokens);
  setExtraText(tokens.join(" "));
};

// handlers
const onSvcPortsToggle = (checked) => {
  // ports è required per questo attacco: non permettere de-selezione UX-wise
  if (!checked) {
    setSvcPortsEnabled(true);
    setSvcPortsWarning("Ports are required (--ports).");
    setTimeout(() => setSvcPortsWarning(null), 2500);
    console.warn("Ports are required for service-enumeration (--ports).");
    return;
  }
  // abilitiamo ed aggiorniamo subito
  setSvcPortsEnabled(true);

  const tokens = [
    "--ports", String(svcPortsValue || "22,23,80,443,502,102,2404,44818,20000")
  ];
  if (svcTimeoutEnabled) tokens.push("--timeout", String(svcTimeoutValue || "1.0"));
  if (svcWorkersEnabled) tokens.push("--workers", String(svcWorkersValue || "100"));
  if (svcVerboseEnabled) tokens.push("--verbose");

  updateAttackArgsBefore(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};
;

const onSvcPortsValueChange = (e) => {
  const raw = e?.target?.value ?? "";
  const cleaned = String(raw).trim();
  setSvcPortsValue(cleaned);

  const ok = validatePortsSpec(cleaned);
  if (!ok) {
    // prevent enabling invalid - keep UI disabled until valid
    if (svcPortsEnabled) setSvcPortsEnabled(false);
    console.warn("Invalid ports specification for service-enumeration:", cleaned);
    return;
  }
  if (!svcPortsEnabled) setSvcPortsEnabled(true);
  rebuildSvcArgs(selectedImage);
  setSvcPortsWarning(null);
};

const onSvcTimeoutToggle = (checked) => {
  // aggiorna UI
  setSvcTimeoutEnabled(Boolean(checked));

  // costruisci token usando 'checked' come sorgente di verità per questo flag
  const tokens = [];
  if (svcPortsEnabled) tokens.push("--ports", String(svcPortsValue || "22,23,80,443,502,102,2404,44818,20000"));
  if (checked) tokens.push("--timeout", String(svcTimeoutValue || "1.0"));
  if (svcWorkersEnabled) tokens.push("--workers", String(svcWorkersValue || "100"));
  if (svcVerboseEnabled) tokens.push("--verbose");

  updateAttackArgsBefore(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};
const onSvcTimeoutValueChange = (e) => {
  const v = e?.target?.value ?? "";
  setSvcTimeoutValue(v);
  // se il flag timeout è abilitato, ricostruisci IMMEDIATAMENTE con il nuovo valore
  if (svcTimeoutEnabled) {
    const tokens = [];
    if (svcPortsEnabled) tokens.push("--ports", String(svcPortsValue || "22,23,80,443,502,102,2404,44818,20000"));
    tokens.push("--timeout", String(v || "1.0"));
    if (svcWorkersEnabled) tokens.push("--workers", String(svcWorkersValue || "100"));
    if (svcVerboseEnabled) tokens.push("--verbose");
    updateAttackArgsBefore(selectedImage, tokens);
    setExtraText(tokens.join(" "));
  }
};

const onSvcWorkersToggle = (checked) => {
  setSvcWorkersEnabled(Boolean(checked));

  const tokens = [];
  if (svcPortsEnabled) tokens.push("--ports", String(svcPortsValue || "22,23,80,443,502,102,2404,44818,20000"));
  if (svcTimeoutEnabled) tokens.push("--timeout", String(svcTimeoutValue || "1.0"));
  if (checked) tokens.push("--workers", String(svcWorkersValue || "100"));
  if (svcVerboseEnabled) tokens.push("--verbose");

  updateAttackArgsBefore(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};
const onSvcWorkersValueChange = (e) => {
  const v = e?.target?.value ?? "";
  setSvcWorkersValue(v);
  if (svcWorkersEnabled) {
    const tokens = [];
    if (svcPortsEnabled) tokens.push("--ports", String(svcPortsValue || "22,23,80,443,502,102,2404,44818,20000"));
    if (svcTimeoutEnabled) tokens.push("--timeout", String(svcTimeoutValue || "1.0"));
    tokens.push("--workers", String(v || "100"));
    if (svcVerboseEnabled) tokens.push("--verbose");
    updateAttackArgsBefore(selectedImage, tokens);
    setExtraText(tokens.join(" "));
  }
};


const onSvcVerboseToggle = (checked) => {
  const next = Boolean(checked);
  setSvcVerboseEnabled(next);

  // costruisci tokens usando 'next' per decidere se includere --verbose
  const tokens = [];
  if (svcPortsEnabled) tokens.push("--ports", String(svcPortsValue || "22,23,80,443,502,102,2404,44818,20000"));
  if (svcTimeoutEnabled) tokens.push("--timeout", String(svcTimeoutValue || "1.0"));
  if (svcWorkersEnabled) tokens.push("--workers", String(svcWorkersValue || "100"));
  if (next) tokens.push("--verbose");

  updateAttackArgsBefore(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};


const rebuildPortArgs = (imageName) => {
  if (!imageName) return;
  const tokens = [];
  if (portPortsEnabled) tokens.push("-p", String(portPortsValue || "21,22,23,25,53,80,443,502"));
  if (portUdpEnabled) tokens.push("--udp");
  if (portTimeoutEnabled) tokens.push("--timeout", String(portTimeoutValue || "1"));
  if (portWorkersEnabled) tokens.push("--workers", String(portWorkersValue || "200"));
  if (portVerboseEnabled) tokens.push("--verbose");

  updateAttackArgsBefore(imageName, tokens);
  // (opzionale) preview
  setExtraText(tokens.join(" "));
};

// handlers
const onPortPortsToggle = (checked) => {
  setPortPortsEnabled(Boolean(checked));
    if (!checked) {
    // Non permettere di togliere la spunta
    setPortPortsEnabled(true);

    // Mostra un hint temporaneo
    setPortPortsWarning("Ports are required (-p/--ports).");
    setTimeout(() => setPortPortsWarning(null), 2500);

    // (opzionale) log in console
    console.warn("Ports are required for port-scanning (-p/--ports).");
    return;
  }
  // usa lo stesso pattern per ricostruire tokens con il nuovo checked
  const tokens = [];
  if (checked) tokens.push("-p", String(portPortsValue || "21,22,23,25,53,80,443,502"));
  if (portUdpEnabled) tokens.push("--udp");
  if (portTimeoutEnabled) tokens.push("--timeout", String(portTimeoutValue || "1"));
  if (portWorkersEnabled) tokens.push("--workers", String(portWorkersValue || "200"));
  if (portVerboseEnabled) tokens.push("--verbose");
  updateAttackArgsBefore(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};
// basic ports spec validator: accetta token separati da virgola, ognuno è
// - singola porta (1-65535) oppure
// - range "A-B" con 1 <= A <= B <= 65535
function validatePortsSpec(spec) {
  if (!spec || !String(spec).trim()) return false;
  // rimuovi spazi attorno e split su virgola
  const tokens = String(spec).trim().split(',').map(t => t.trim()).filter(Boolean);
  if (tokens.length === 0) return false;

  for (const tok of tokens) {
    // solo numeri e dash ammessi (no altri char)
    if (!/^\d+(-\d+)?$/.test(tok)) return false;

    if (tok.includes('-')) {
      const [aStr, bStr] = tok.split('-');
      const a = Number(aStr);
      const b = Number(bStr);
      if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
      if (a < 1 || b < 1 || a > 65535 || b > 65535) return false;
      if (a > b) return false;
    } else {
      const n = Number(tok);
      if (!Number.isInteger(n) || n < 1 || n > 65535) return false;
    }
  }
  return true;
}


const rebuildOsArgs = (imageName) => {
  if (!imageName) return;
  const tokens = [];
  if (osTimeoutEnabled) tokens.push("--timeout", String(osTimeoutValue || "1"));
  if (osWorkersEnabled) tokens.push("--workers", String(osWorkersValue || "50"));
  if (osVerboseEnabled) tokens.push("--verbose");

  updateAttackArgsAfter(imageName, tokens);
  setExtraText(tokens.join(" "));
};

const onOsTimeoutToggle = (checked) => {
  // aggiorna stato UI
  setOsTimeoutEnabled(Boolean(checked));
  // ricostruisci direttamente usando il valore "checked"
  const tokens = [];
  if (checked) tokens.push("--timeout", String(osTimeoutValue || "1"));
  if (osWorkersEnabled) tokens.push("--workers", String(osWorkersValue || "50"));
  if (osVerboseEnabled) tokens.push("--verbose");
  updateAttackArgsAfter(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};

const onOsTimeoutValueChange = (e) => {
  const v = e?.target?.value ?? "";
  setOsTimeoutValue(v);
  // se il flag è attivo, ricostruisci
  if (osTimeoutEnabled) rebuildOsArgs(selectedImage);
};

const onOsWorkersToggle = (checked) => {
  setOsWorkersEnabled(Boolean(checked));
  const tokens = [];
  if (osTimeoutEnabled) tokens.push("--timeout", String(osTimeoutValue || "1"));
  if (checked) tokens.push("--workers", String(osWorkersValue || "50"));
  if (osVerboseEnabled) tokens.push("--verbose");
  updateAttackArgsAfter(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};

const onOsWorkersValueChange = (e) => {
  const v = e?.target?.value ?? "";
  setOsWorkersValue(v);
  if (osWorkersEnabled) rebuildOsArgs(selectedImage);
};

const onOsVerboseToggle = (checked) => {
  // usa checked direttamente per evitare race-conditions
  setOsVerboseEnabled(Boolean(checked));
  const tokens = [];
  if (osTimeoutEnabled) tokens.push("--timeout", String(osTimeoutValue || "1"));
  if (osWorkersEnabled) tokens.push("--workers", String(osWorkersValue || "50"));
  if (checked) tokens.push("--verbose");
  updateAttackArgsAfter(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};

// handler più robusto per l'input delle porte
const onPortPortsValueChange = (e) => {
  const raw = e?.target?.value ?? "";
  const cleaned = String(raw).trim();

  // salva sempre il valore così l'utente vede cosa ha digitato
  setPortPortsValue(cleaned);

  // validazione veloce
  const ok = validatePortsSpec(cleaned);

  if (!ok) {
    // disabilitiamo il flag -p per evitare di lanciare lo script senza porte valide
    if (portPortsEnabled) setPortPortsEnabled(false);

    // log utile per debugging; puoi anche esporre portPortsError in UI
    console.warn("Invalid ports specification, will not enable -p flag:", cleaned);

    // opzionale: se vuoi fornire un feedback visibile, crea uno state portPortsError e setta qui:
    // setPortPortsError("Invalid ports format. Use e.g. 22,80,100-200");

    // non ricostruire gli args finché non è valido
    return;
  }

  // se arriviamo qui => spec valida: abilitiamo automaticamente -p (se non già)
  if (!portPortsEnabled) setPortPortsEnabled(true);

  // ora ricostruisci gli args (rebuildPortArgs deve includere la logica che aggiunge "-p" o "--ports")
  // se la tua rebuild accetta il valore delle porte separatamente, potresti voler passarlo lì.
  // Qui assumiamo rebuildPortArgs(selectedImage) legge lo stato corrente (portPortsEnabled/portPortsValue).
  rebuildPortArgs(selectedImage);

  // pulizia: rimuovi eventuale errore visuale se esiste
  // if (portPortsError) setPortPortsError(null);
};

const onPortUdpToggle = (checked) => {
  const next = Boolean(checked);
  setPortUdpEnabled(next);

  const tokens = [];
  // -p è obbligatorio
  tokens.push("-p", String(portPortsValue || "21,22,23,25,53,80,443,502"));
  if (next) tokens.push("--udp");
  if (portTimeoutEnabled) tokens.push("--timeout", String(portTimeoutValue || "1"));
  if (portWorkersEnabled) tokens.push("--workers", String(portWorkersValue || "200"));
  if (portVerboseEnabled) tokens.push("--verbose");

  updateAttackArgsBefore(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};


const onPortTimeoutToggle = (checked) => {
  const next = Boolean(checked);
  setPortTimeoutEnabled(next);

  const tokens = [];
  tokens.push("-p", String(portPortsValue || "21,22,23,25,53,80,443,502"));
  if (portUdpEnabled) tokens.push("--udp");
  if (next) tokens.push("--timeout", String(portTimeoutValue || "1"));
  if (portWorkersEnabled) tokens.push("--workers", String(portWorkersValue || "200"));
  if (portVerboseEnabled) tokens.push("--verbose");

  updateAttackArgsBefore(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};

const onPortTimeoutValueChange = (e) => {
  const v = e.target.value;
  setPortTimeoutValue(v);

  const tokens = [];
  tokens.push("-p", String(portPortsValue || "21,22,23,25,53,80,443,502"));
  if (portUdpEnabled) tokens.push("--udp");
  if (portTimeoutEnabled) tokens.push("--timeout", String(v || "1")); // usa SUBITO il nuovo valore
  if (portWorkersEnabled) tokens.push("--workers", String(portWorkersValue || "200"));
  if (portVerboseEnabled) tokens.push("--verbose");

  updateAttackArgsBefore(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};

const onPortWorkersToggle = (checked) => {
  const next = Boolean(checked);
  setPortWorkersEnabled(next);

  const tokens = [];
  tokens.push("-p", String(portPortsValue || "21,22,23,25,53,80,443,502"));
  if (portUdpEnabled) tokens.push("--udp");
  if (portTimeoutEnabled) tokens.push("--timeout", String(portTimeoutValue || "1"));
  if (next) tokens.push("--workers", String(portWorkersValue || "200"));
  if (portVerboseEnabled) tokens.push("--verbose");

  updateAttackArgsBefore(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};
const onPortWorkersValueChange = (e) => {
  const v = e.target.value;
  setPortWorkersValue(v);

  const tokens = [];
  tokens.push("-p", String(portPortsValue || "21,22,23,25,53,80,443,502"));
  if (portUdpEnabled) tokens.push("--udp");
  if (portTimeoutEnabled) tokens.push("--timeout", String(portTimeoutValue || "1"));
  if (portWorkersEnabled) tokens.push("--workers", String(v || "200")); // usa SUBITO il nuovo valore
  if (portVerboseEnabled) tokens.push("--verbose");

  updateAttackArgsBefore(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};

// handler robusto per il toggle verbose (usa il nuovo valore subito, evita race condition)
const onPortVerboseToggle = (checked) => {
  // aggiorna lo stato UI (per render)
  setPortVerboseEnabled(Boolean(checked));

  // ricostruisci i token usando IL NUOVO VALORE "checked" (non lo state)
  const tokens = [];
  if (portPortsEnabled) tokens.push("-p", String(portPortsValue || "21,22,23,25,53,80,443,502"));
  if (portUdpEnabled) tokens.push("--udp");
  if (portTimeoutEnabled) tokens.push("--timeout", String(portTimeoutValue || "1"));
  if (portWorkersEnabled) tokens.push("--workers", String(portWorkersValue || "200"));
  if (checked) tokens.push("--verbose");

  // aggiorna i parametri nel modello e preview
  updateAttackArgsBefore(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};

function updateAttackArgsAfter(attackName, tokens) {
  let updated = false;

  // aggiorna in-place l'array attacks se esiste
  if (Array.isArray(attacks)) {
    const a = attacks.find(x => x.name === attackName || x.image === attackName || x.displayName === attackName);
    if (a) {
      a.parameters = a.parameters || {};
      a.parameters.argsAfterTargets = Array.isArray(tokens) ? tokens : tokenize(String(tokens));
      updated = true;
    }
  }

  // fallback: aggiorna anche attacksModel (se importato)
  try {
    if (typeof attacksModel !== "undefined") {
      const b = attacksModel.find(x => x.name === attackName || x.image === attackName || x.displayName === attackName);
      if (b) {
        b.parameters = b.parameters || {};
        b.parameters.argsAfterTargets = Array.isArray(tokens) ? tokens : tokenize(String(tokens));
        updated = true;
      }
    }
  } catch (e) {
    // ignore se attacksModel non è disponibile
  }

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

const rebuildIcmpArgs = (imageName) => {
  if (!imageName) return;
  const tokens = [];
  if (icmpWorkersEnabled) {
    tokens.push("--workers", String(icmpWorkersValue || "50"));
  }
  if (icmpTimeoutEnabled) {
    tokens.push("--timeout", String(icmpTimeoutValue || "1"));
  }
  if (icmpVerbose) {
    tokens.push("--verbose");
  }
  updateAttackArgsAfter(imageName, tokens);
  setExtraText(tokens.join(" "));
};

const onExtraTextChange = (ev) => {
  const val = ev.target.value;
  setExtraText(val);
  if (!selectedImage) return;
  const tokens = tokenize(val);
  updateAttackArgsAfter(selectedImage, tokens);
};




const onIcmpVerboseChange = (checked) => {
  // checked è booleano (true = selezionato, false = deselezionato)
  setIcmpVerbose(Boolean(checked));
  // ricostruisci subito gli args (aggiunge o rimuove --verbose)
  rebuildIcmpArgs(selectedImage);
};

const onIcmpWorkersChange = (ev) => {
  const raw = ev.target.value;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return;
  setIcmpWorkers(n);
  if (!selectedImage) return;
  updateAttackArgsAfter(selectedImage, ["--workers", String(n)]);
  setExtraText(`--workers ${n}`);
};

const onWorkersValueChange = (e) => {
  const v = e.target.value;
  setIcmpWorkersValue(v);
  const n = parseInt(v, 10);
  if (!Number.isNaN(n)) setIcmpWorkers(n);
  rebuildIcmpArgs(selectedImage);
};

const onTimeoutToggle = (checked) => {
  setIcmpTimeoutEnabled(checked);
  rebuildIcmpArgs(selectedImage);
};

const onTimeoutValueChange = (e) => {
  const v = e.target.value;
  setIcmpTimeoutValue(v);
  rebuildIcmpArgs(selectedImage);
};



const onWorkersToggle = (checked) => {
  setIcmpWorkersEnabled(checked);
  // sync legacy
  if (checked) {
    const n = parseInt(icmpWorkersValue || "50", 10);
    if (!Number.isNaN(n)) setIcmpWorkers(n);
  }
  rebuildIcmpArgs(selectedImage);
};


const onParamRadioChange = (value) => {
  setSelectedParam(value);
  if (!selectedImage) return;

  // se passo a --timeout e non c’è un valore numerico, default 1
  let nextVal = paramValue;
  if (value === "--timeout") {
    const asNum = parseFloat(paramValue);
    if (Number.isNaN(asNum) || paramValue.trim() === "") {
      nextVal = "1";
      setParamValue(nextVal);
    }
  }
  if (value === "--workers") {
    const asInt = parseInt(paramValue, 10);
    if (Number.isNaN(asInt) || paramValue.trim() === "") {
      nextVal = "50";
      setParamValue(nextVal);
      setIcmpWorkers(50);
    }
  }

  const tokens = [value, String(nextVal)];
  if (icmpVerbose) tokens.push("--verbose");
  updateAttackArgsAfter(selectedImage, tokens);
  setExtraText(tokens.join(" "));
};

const onParamValueChange = (ev) => {
  const val = ev.target.value;
  setParamValue(val);
  if (!selectedImage) return;
  const tokens = [selectedParam, String(val)];
  if (icmpVerbose) tokens.push("--verbose");
  updateAttackArgsAfter(selectedImage, tokens);
  setExtraText(tokens.join(" "));

  if (selectedParam === "--workers") {
    const n = parseInt(val, 10);
    if (!Number.isNaN(n)) setIcmpWorkers(n);
  }
};

    // aggiungi sopra il componente (o in util separato)
const ipRegex = /^(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\.(?:25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/;

function computeSubnetFromIp(rawIp) {
  if (!rawIp) return null;
  // se il campo è tipo "192.168.10.5/24" -> ritorna "192.168.10.0/24"
  if (String(rawIp).includes("/")) {
    try {
      return String(rawIp).trim();
    } catch (e) {
      return null;
    }
  }
  // altrimenti prova a costruire /24
  const ipOnly = String(rawIp).split("/")[0].trim();
  const oct = ipOnly.split(".");
  if (oct.length === 4) {
    return `${oct[0]}.${oct[1]}.${oct[2]}.0/24`;
  }
  return null;
}

const onArpModeChange = (val) => {
  setArpMode(val);

  // se non abbiamo attacco selezionato, niente da fare
  if (!selectedImage) return;

  // recupera definizione (può essere null)
  const def = getAttackDefinition(selectedImage);
  if (!def) return;

  if (val === "whole-subnet") {
    // salva il valore precedente solo se non lo abbiamo già salvato
    try {
      const prev = (def.parameters && def.parameters.argsAfterTargets) ? JSON.parse(JSON.stringify(def.parameters.argsAfterTargets)) : null;
      if (arpPrevArgsAfter === null) {
        setArpPrevArgsAfter(prev);
      }
    } catch (e) {
      setArpPrevArgsAfter(null);
    }

    // ottieni ip attaccante
    const attackerIpRaw = attacker?.interfaces?.if?.[0]?.ip || attacker?.ip || null;
    const subnet = computeSubnetFromIp(attackerIpRaw);
    if (!subnet) {
      console.warn("Cannot compute subnet from attacker IP:", attackerIpRaw);
      return;
    }
    // aggiorna argsAfterTargets con la subnet
    updateAttackArgsAfter(selectedImage, [String(subnet)]);
  } else {
    // modalita "targets": ripristina il valore precedente se presente, altrimenti svuota
    if (arpPrevArgsAfter !== null) {
      updateAttackArgsAfter(selectedImage, arpPrevArgsAfter);
      setArpPrevArgsAfter(null); // consumato
    } else {
      // nessun valore precedente: rimuovi argsAfterTargets
      updateAttackArgsAfter(selectedImage, []);
    }
  }
};

useEffect(() => {
  setArpPrevArgsAfter(null);
  // ... resto della logica esistente che popola extraText / icmp ecc.
}, [selectedImage]);

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


// helper: cerca definizione attacco (se non esiste già)
function getAttackDefinition(attackName) {
  if (!Array.isArray(attacks)) return null;
  return attacks.find(a => a.name === attackName || a.image === attackName || a.displayName === attackName) || null;
}

// aggiungi questa helper function vicino all'inizio del componente (prima di toggleAttack)
// aggiungi questa helper function vicino all'inizio del componente (prima di toggleAttack)
function resetAllParamStates() {
  // ICMP
  setIcmpWorkersEnabled(true);
  setIcmpWorkersValue("50");
  setIcmpTimeoutEnabled(false);
  setIcmpTimeoutValue("1");
  setIcmpVerbose(false);
  setIcmpWorkers(50);

  // PORT scanning
  setPortPortsEnabled(true);
  setPortPortsValue("21,22,23,25,53,80,443,502");
  setPortUdpEnabled(false);
  setPortTimeoutEnabled(false);
  setPortTimeoutValue("1");
  setPortWorkersEnabled(false);
  setPortWorkersValue("200");
  setPortVerboseEnabled(false);
  setPortPortsWarning(null);

  // OS fingerprint
  setOsTimeoutEnabled(false);
  setOsTimeoutValue("1");
  setOsWorkersEnabled(false);
  setOsWorkersValue("50");
  setOsVerboseEnabled(false);

  // SERVICE enumeration
  setSvcPortsEnabled(true);
  setSvcPortsValue("22,23,80,443,502,102,2404,44818,20000");
  setSvcTimeoutEnabled(false);
  setSvcTimeoutValue("1.0");
  setSvcWorkersEnabled(false);
  setSvcWorkersValue("100");
  setSvcVerboseEnabled(false);
  setSvcPortsWarning(null);

  // extra text / arp
  setExtraText("");
  setArpMode("targets");
  setArpPrevArgsAfter(null);
}
// sostituisci la tua toggleAttack con questa (minima, ma completa)
const toggleAttack = (val) => {
  // conserva l'immagine richiesta per uso dopo setMachines
  const requestedImage = val;

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

    if (attackerIndex === -1) return machinesReset;

    const currAttacker = prevMachines[attackerIndex];

    // caso: era caricato -> unload
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

    // se val falsy -> considera unload (sicuro)
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

    // stiamo caricando un attacco nuovo
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

    const before = normalizeParamTokens(params.argsBeforeTargets);
    let after = normalizeParamTokens(params.argsAfterTargets);
    if (attackDef?.name === "port-scanning") after = [];

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

  // IMPORTANT: dopo setMachines, sincronizzi il modello con lo stato UI corrente
  // (non dentro setMachines perché non puoi usare hook lì)
  try {
    const def = getAttackDefinition(requestedImage);
    if (!def) return;

    if (def.name === "port-scanning") {
      rebuildPortArgs(requestedImage);
    } else if (def.name === "service-enumeration") {
      rebuildSvcArgs(requestedImage);
    } else if (def.name === "os-fingerprint" || def.name === "os-fingerprinting") {
      rebuildOsArgs(requestedImage);
    } else if (def.name === "icmp-scanning") {
      rebuildIcmpArgs(requestedImage);
    } else {
      // fallback: se serve puoi aggiungere altri rebuild helper
    }
  } catch (e) {
    console.warn("toggleAttack post-rebuild failed:", e);
  }
};

 

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
                        {/* Param box (differente per attacco selezionato) */}
            <div className="grid gap-2">
              {selectedImage ? (
                (() => {
                  const def = getAttackDefinition(selectedImage);
                  if (!def) return <div className="text-xs text-foreground">Selected attack definition not found.</div>;

                if (def.name === "icmp-scanning") {
  return (
    <div className="grid gap-3">
      {/* Workers */}
      <div className="flex items-end gap-3">
        <Checkbox
          isSelected={icmpWorkersEnabled}
          onValueChange={onWorkersToggle}
        >
          <span className="font-mono text-xs">--workers</span>
        </Checkbox>
        <Input
          type="number"
          label="workers"
          min={1}
          max={500}
          size="sm"
          value={icmpWorkersValue}
          onChange={onWorkersValueChange}
          isDisabled={!icmpWorkersEnabled}
          className="max-w-[140px]"
        />
      </div>

      {/* Timeout */}
      <div className="flex items-end gap-3">
        <Checkbox
          isSelected={icmpTimeoutEnabled}
          onValueChange={onTimeoutToggle}
        >
          <span className="font-mono text-xs">--timeout</span>
        </Checkbox>
        <Input
          type="number"
          step="0.1"
          min={0.1}
          label="seconds"
          size="sm"
          value={icmpTimeoutValue}
          onChange={onTimeoutValueChange}
          isDisabled={!icmpTimeoutEnabled}
          className="max-w-[140px]"
        />
      </div>

      {/* Verbose */}
<div className="flex items-center gap-3">
  <Checkbox
    isSelected={icmpVerbose}
    onValueChange={(checked) => {
      setIcmpVerbose(checked);
      rebuildIcmpArgs(selectedImage);
    }}
  >
    <span className="font-mono text-xs">--verbose</span>
  </Checkbox>
</div>

      {/* Hint opzionale */}
      <div className="text-xs text-muted">
        Verranno salvati in <code className="font-mono">argsAfterTargets</code> tutti i parametri abilitati
        (esempio: <code className="font-mono">--workers 60 --timeout 4 --verbose</code>).
      </div>
    </div>
  );
}
            if (def.name === "arp-scanning") {
  return (
    <div className="grid gap-2">
      {/* RadioGroup con due opzioni: usare i targets selezionati oppure l'intera subnet */}
      <RadioGroup
        label="ARP mode"
        orientation="horizontal"
        value={arpMode}
        onValueChange={onArpModeChange}
      >
        <Radio value="targets">Use selected targets</Radio>
        <Radio value="whole-subnet">Attack on the whole subnet</Radio>
      </RadioGroup>

      {/* NOTE: per arp-scanning NON mostrare la textbox generica (è stata rimossa) */}
      <div className="text-xs text-muted">
        When you select <strong>Attack on the whole subnet</strong>, the system will extract the attacker’s IP address and automatically set the <code>argsAfterTargets</code> to the corresponding subnet (e.g. <code>192.168.10.0/24</code>).
      </div>
    </div>
  );
}

if (def.name === "port-scanning") {
  return (
    <div className="grid gap-3">
      {/* Ports */}
      <div className="flex items-end gap-3">
        <Checkbox
          isSelected={portPortsEnabled}
          onValueChange={onPortPortsToggle}
        >
          <span className="font-mono text-xs">-p / --ports</span>
        </Checkbox>
        <Input
          type="text"
          label="ports"
          size="sm"
          value={portPortsValue}
          onChange={onPortPortsValueChange}
          isDisabled={!portPortsEnabled}
          className="max-w-[260px]"
          placeholder="es. 22,80,443 o 1-1024"
        />
        {portPortsWarning && (
  <div className="text-xs text-danger">
    {portPortsWarning}
  </div>
)}
      </div>

      {/* UDP */}
      <div className="flex items-center gap-3">
        <Checkbox
          isSelected={portUdpEnabled}
          onValueChange={onPortUdpToggle}
        >
          <span className="font-mono text-xs">--udp</span>
        </Checkbox>
      </div>

      {/* Timeout */}
      <div className="flex items-end gap-3">
        <Checkbox
          isSelected={portTimeoutEnabled}
          onValueChange={onPortTimeoutToggle}
        >
          <span className="font-mono text-xs">--timeout</span>
        </Checkbox>
        <Input
          type="number"
          step="0.1"
          min={0.1}
          label="seconds"
          size="sm"
          value={portTimeoutValue}
          onChange={onPortTimeoutValueChange}
          isDisabled={!portTimeoutEnabled}
          className="max-w-[140px]"
        />
      </div>

      {/* Workers */}
      <div className="flex items-end gap-3">
        <Checkbox
          isSelected={portWorkersEnabled}
          onValueChange={onPortWorkersToggle}
        >
          <span className="font-mono text-xs">--workers</span>
        </Checkbox>
        <Input
          type="number"
          min={1}
          max={1000}
          label="threads"
          size="sm"
          value={portWorkersValue}
          onChange={onPortWorkersValueChange}
          isDisabled={!portWorkersEnabled}
          className="max-w-[140px]"
        />
      </div>

      {/* Verbose */}
      <div className="flex items-center gap-3">
        <Checkbox
          isSelected={portVerboseEnabled}
          onValueChange={onPortVerboseToggle}
        >
          <span className="font-mono text-xs">--verbose</span>
        </Checkbox>
      </div>

      <div className="text-xs text-muted">
        These parameters will be utilsed to respect the script syntax.
      </div>
    </div>
  );
}

if (def.name === "os-fingerprint") {
  return (
    <div className="grid gap-3">
      {/* Timeout */}
      <div className="flex items-end gap-3">
        <Checkbox
          isSelected={osTimeoutEnabled}
          onValueChange={onOsTimeoutToggle}
        >
          <span className="font-mono text-xs">--timeout</span>
        </Checkbox>
        <Input
          type="number"
          step="0.1"
          min={0.1}
          label="seconds"
          size="sm"
          value={osTimeoutValue}
          onChange={onOsTimeoutValueChange}
          isDisabled={!osTimeoutEnabled}
          className="max-w-[140px]"
        />
      </div>

      {/* Workers */}
      <div className="flex items-end gap-3">
        <Checkbox
          isSelected={osWorkersEnabled}
          onValueChange={onOsWorkersToggle}
        >
          <span className="font-mono text-xs">--workers</span>
        </Checkbox>
        <Input
          type="number"
          min={1}
          max={1000}
          label="threads"
          size="sm"
          value={osWorkersValue}
          onChange={onOsWorkersValueChange}
          isDisabled={!osWorkersEnabled}
          className="max-w-[140px]"
        />
      </div>

      {/* Verbose */}
      <div className="flex items-center gap-3">
        <Checkbox
          isSelected={osVerboseEnabled}
          onValueChange={onOsVerboseToggle}
        >
          <span className="font-mono text-xs">--verbose</span>
        </Checkbox>
      </div>

      <div className="text-xs text-muted">
        These parameters will be saved in <code className="font-mono">argsAfterTargets</code> (script expects options after targets).
      </div>
    </div>
  );
}

if (def.name === "service-enumeration") {
  return (
    <div className="grid gap-3">
      {/* Ports */}
      <div className="flex items-end gap-3">
        <Checkbox isSelected={svcPortsEnabled} onValueChange={onSvcPortsToggle}>
          <span className="font-mono text-xs">--ports</span>
        </Checkbox>
        <Input
          type="text"
          label="ports"
          size="sm"
          value={svcPortsValue}
          onChange={onSvcPortsValueChange}
          isDisabled={!svcPortsEnabled}
          className="max-w-[260px]"
          placeholder="ex. 22,80,100-200"
        />
        {svcPortsWarning && <div className="text-xs text-danger">{svcPortsWarning}</div>}
      </div>

      {/* Timeout */}
      <div className="flex items-end gap-3">
        <Checkbox isSelected={svcTimeoutEnabled} onValueChange={onSvcTimeoutToggle}>
          <span className="font-mono text-xs">--timeout</span>
        </Checkbox>
        <Input
          type="number"
          step="0.1"
          min={0.1}
          label="seconds"
          size="sm"
          value={svcTimeoutValue}
          onChange={onSvcTimeoutValueChange}
          isDisabled={!svcTimeoutEnabled}
          className="max-w-[140px]"
        />
      </div>

      {/* Workers */}
      <div className="flex items-end gap-3">
        <Checkbox isSelected={svcWorkersEnabled} onValueChange={onSvcWorkersToggle}>
          <span className="font-mono text-xs">--workers</span>
        </Checkbox>
        <Input
          type="number"
          min={1}
          max={2000}
          label="threads"
          size="sm"
          value={svcWorkersValue}
          onChange={onSvcWorkersValueChange}
          isDisabled={!svcWorkersEnabled}
          className="max-w-[140px]"
        />
      </div>


      {/* Verbose */}
      <div className="flex items-center gap-3">
        <Checkbox isSelected={svcVerboseEnabled} onValueChange={onSvcVerboseToggle}>
          <span className="font-mono text-xs">--verbose</span>
        </Checkbox>
      </div>

      <div className="text-xs text-muted">
        Flags saranno salvati in <code className="font-mono">argsBeforeTargets</code> (devono comparire prima dei target).
      </div>
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
    )
}

export default Reconnaissance;
