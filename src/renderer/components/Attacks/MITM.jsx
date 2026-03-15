import { Card, CardBody, Input } from "@nextui-org/react";
import { Checkbox } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { useState, useEffect, useContext } from "react";
import { FaArrowRotateLeft } from "react-icons/fa6";
import { NotificationContext } from "../../contexts/NotificationContext";
import { XSymbol } from "../Symbols/XSymbol";
import MachineSelector from "./MachineSelector";
import AttackSelector from "./AttackSelector";
import { attacksModel } from "../../models/model";
import { extractTargetIPs } from "../../utils/ipUtils";

function MITM({ attacker, attacks, isLoading, machines, setMachines, handleRefresh }) {
  const [selectedImage, setSelectedImage] = useState(attacker?.attackImage || "");
  const { setAttackLoaded } = useContext(NotificationContext);
  const [targets, setTargets] = useState(attacker?.targets || []);
  const [extraText, setExtraText] = useState("");

  // ---------------------------
  //      PING / FLOOD STATES
  // ---------------------------
  const [pingTimeoutEnabled, setPingTimeoutEnabled] = useState(false);
  const [pingTimeoutValue, setPingTimeoutValue] = useState("1");
  const [pingAEnabled, setPingAEnabled] = useState(false);
  const [pingAText, setPingAText] = useState("");

  const [liteCountEnabled, setLiteCountEnabled] = useState(false);
  const [liteCountValue, setLiteCountValue] = useState("100");
  const [speedMode, setSpeedMode] = useState(null); // 'fast' | 'faster' | null

  // ICMP-only (per i ping, già presenti)
  const [icmpCodeEnabled, setIcmpCodeEnabled] = useState(false);
  const [icmpCodeValue, setIcmpCodeValue] = useState("0");
  // SYN/UDP-only (per i ping, già presenti)
  const [basePortEnabled, setBasePortEnabled] = useState(false);
  const [basePortValue, setBasePortValue] = useState("");
  const [destPortEnabled, setDestPortEnabled] = useState(false);
  const [destPortValue, setDestPortValue] = useState("");

  // ---------------------------
  //      ARP SPOOFING STATES
  // ---------------------------
  const [arpIface, setArpIface] = useState("");
  const [arpGateway, setArpGateway] = useState("");
  const [arpVictimMac, setArpVictimMac] = useState("");
  const [arpGatewayMac, setArpGatewayMac] = useState("");
  const [arpCountEnabled, setArpCountEnabled] = useState(false);
  const [arpCountValue, setArpCountValue] = useState("0"); // 0 = infinito (come nello script)
  const [arpBidir, setArpBidir] = useState(true);
  const [arpRestore, setArpRestore] = useState(true);

  // ARP: toggle per i 4 parametri (iface/gateway sempre ON e non disattivabili)
  const [arpIfaceEnabled] = useState(true);
  const [arpGatewayEnabled] = useState(true);
  const [arpVictimMacEnabled, setArpVictimMacEnabled] = useState(false);
  const [arpGatewayMacEnabled, setArpGatewayMacEnabled] = useState(false);

  // ---------------------------
  //    NOMI/CHIAVI ATTACCHI
  // ---------------------------
  const DOS_FLOOD = new Set(["icmp-flood", "syn-flood", "udp-flood"]);
  const DOS_LITE = new Set(["icmp-floodlite", "syn-floodlite", "udp-floodlite"]);
  const DOS_ALL = new Set([...DOS_FLOOD, ...DOS_LITE]);

  const isIcmpKey = (k) => k.includes("icmp");
  const isSynKey = (k) => k.includes("syn");
  const isUdpKey = (k) => k.includes("udp");

  // ⚠️ identifica ARP spoofing: adatta le chiavi ai tuoi name reali
  const isArpAttack = (def) => {
    const n = (def?.name || "").toLowerCase();
    return n.includes("arp") && n.includes("spoo"); // es. "arp-spoof", "arp-spoofing"
  };

  // mapping di base (PING)
  const PING_BEFORE_TOKENS_BY_NAME = {
    "icmp-flood": ["-1", "--flood"],
    "syn-flood": ["-S", "--flood"],
    "udp-flood": ["-2", "--flood"],
    "icmp-floodlite": ["-1"],
    "syn-floodlite": ["-S"],
    "udp-floodlite": ["-2"],
  };

  const [arpPrevArgsAfter, setArpPrevArgsAfter] = useState(null);

  useEffect(() => {
    setSelectedImage(attacker?.attackImage || "");
    setTargets(attacker?.targets || []);
  }, [attacker]);

  useEffect(() => {
    const def = getAttackDefinition(selectedImage);
    if (def && def.parameters) {
      const after = def.parameters.argsAfterTargets;
      if (Array.isArray(after) && after.length) {
        setExtraText(after.join(' '));

        // parsing parametri (solo per ping flood/lite – lasciamo com'è)
        if (DOS_ALL.has(def.name)) {
          const afterAll = Array.isArray(def.parameters.argsAfterTargets)
            ? def.parameters.argsAfterTargets.map(String)
            : (typeof def.parameters.argsAfterTargets === "string"
              ? (def.parameters.argsAfterTargets.match(/\S+/g) || [])
              : []);

          let toOn = false, toVal = "1";
          let aOn = false, aVal = "";
          for (let i = 0; i < afterAll.length; i++) {
            const t = afterAll[i];
            if (t === "--timeout") {
              const v = afterAll[i + 1];
              if (v && !isNaN(parseFloat(v))) { toOn = true; toVal = String(v); i++; }
              else { toOn = true; toVal = "1"; }
            } else if (t === "-a") {
              const v = afterAll[i + 1];
              if (v && !v.startsWith("-")) { aOn = true; aVal = String(v); i++; }
              else { aOn = true; aVal = ""; }
            }
          }
          setPingTimeoutEnabled(toOn);
          setPingTimeoutValue(toVal);
          setPingAEnabled(aOn);
          setPingAText(aVal);
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
    } catch { }
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

        // ⬇️ ARP: usa solo il PRIMO IP come vittima (posizionale)
        let cleanIps = extractTargetIPs(targets, attackerDomain, { allowOtherDomains: true });
        if (isArpAttack(def)) cleanIps = cleanIps.slice(0, 1);

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
    } catch (e) { }
    if (!updated) console.warn("updateAttackArgsAfter: attack not found:", attackName);

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
        let cleanIps = extractTargetIPs(targets, attackerDomain, { allowOtherDomains: true });
        // ⬇️ ARP: usa solo il PRIMO IP come vittima
        if (isArpAttack(attackDef)) cleanIps = cleanIps.slice(0, 1);

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

  // ---------------------------
  //  Costruzione BEFORE tokens
  // ---------------------------
  function getArpBeforeTokens() {
    const before = [];

    // iface & gateway: obbligatori -> checkbox sempre true
    if (arpIfaceEnabled && arpIface.trim()) {
      before.push("--iface", arpIface.trim());
    }
    if (arpGatewayEnabled && arpGateway.trim()) {
      before.push("--gateway", arpGateway.trim());
    }

    // opzionali: solo se abilitati
    if (arpVictimMacEnabled && arpVictimMac.trim()) {
      before.push("--victim-mac", arpVictimMac.trim());
    }
    if (arpGatewayMacEnabled && arpGatewayMac.trim()) {
      before.push("--gateway-mac", arpGatewayMac.trim());
    }

    if (arpCountEnabled) {
      const v = String(arpCountValue || "0").trim();
      before.push("--count", v);
    }

    if (arpBidir) before.push("--bidirectional");
    before.push(arpRestore ? "--restore" : "--no-restore");

    return before;
  }

  function getPingBeforeTokens(defName, opts = {}) {
    const {
      aEnabled = false, aText = "",
      isLite = false,
      countEnabled = false, countValue = "10",
      speed = null,
      icmpCodeEnabled = false, icmpCodeValue = "0",
      basePortEnabled = false, basePortValue = "",
      destPortEnabled = false, destPortValue = "",
    } = opts;

    const base = PING_BEFORE_TOKENS_BY_NAME[defName] || PING_BEFORE_TOKENS_BY_NAME["icmp-flood"];
    const before = [...base];

    if (isLite) {
      if (speed === "fast") before.push("--fast");
      if (speed === "faster") before.push("--faster");
      const effectiveCount = countEnabled ? String(countValue || "10") : "100";
      before.push("-c", effectiveCount);
    }
    if (defName.includes("icmp") && icmpCodeEnabled) {
      const v = String(icmpCodeValue ?? "").trim();
      if (v !== "") before.push("--icmpcode", v);
    }
    if (!defName.includes("icmp")) {
      if (basePortEnabled) {
        const v = String(basePortValue ?? "").trim();
        if (v !== "") before.push("--baseport", v);
      }
      if (destPortEnabled) {
        const v = String(destPortValue ?? "").trim();
        if (v !== "") before.push("--destport", v);
      }
    }
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
    if (short.includes("syn")) return short.includes("lite") ? "syn-floodlite" : "syn-flood";
    if (short.includes("udp")) return short.includes("lite") ? "udp-floodlite" : "udp-flood";
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

  const rebuildArgs = (imageName) => {
    if (!imageName) return;
    const def = getAttackDefinition(imageName);

    // === ARP SPOOFING ===
    if (isArpAttack(def)) {
      const beforeTokens = getArpBeforeTokens();
      updateAttackArgsBefore(imageName, beforeTokens);
      updateAttackArgsAfter(imageName, []); // niente after
      setExtraText(beforeTokens.join(" "));
      return;
    }

    // === PING FLOOD/LITE ===
    const mapKey = getPingKey(getAttackDefinition(imageName), selectedImage, imageName);
    const isLite = DOS_LITE.has(mapKey);
    const beforeTokens = getPingBeforeTokens(mapKey, {
      aEnabled: pingAEnabled,
      aText: pingAText,
      isLite,
      countEnabled: liteCountEnabled,
      countValue: liteCountValue,
      speed: speedMode,
      icmpCodeEnabled,
      icmpCodeValue,
      basePortEnabled,
      basePortValue: clampPort(basePortValue),
      destPortEnabled,
      destPortValue: clampPort(destPortValue),
    });

    updateAttackArgsBefore(imageName, beforeTokens);
    updateAttackArgsAfter(imageName, []);
    setExtraText(beforeTokens.join(" "));
  };

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
  };
  const onPingTimeoutValueChange = (e) => {
    const v = e?.target?.value ?? "";
    setPingTimeoutValue(v);
  };
  const onPingAToggle = (checked) => {
    setPingAEnabled(Boolean(checked));
    if (selectedImage) rebuildArgs(selectedImage);
  };
  const onPingATextChange = (e) => {
    const v = e?.target?.value ?? "";
    setPingAText(v);
  };



  function getAttackDefinition(attackName) {
    if (!Array.isArray(attacks)) return null;
    return attacks.find(a => a.name === attackName || a.image === attackName || a.displayName === attackName) || null;
  }

  function resetAllParamStates() {

    /*setExtraText("");
    setPingTimeoutEnabled(false);
    setPingTimeoutValue("1");
    setPingAEnabled(false);
    setPingAText("");
    setLiteCountEnabled(false);
    setLiteCountValue("100");
    setSpeedMode(null);
    setIcmpCodeEnabled(false);
    setIcmpCodeValue("0");
    setBasePortEnabled(false);
    setBasePortValue("");
    setDestPortEnabled(false);
    setDestPortValue("");
    */

    // ARP
    setArpIface("");
    setArpGateway("");
    setArpVictimMac("");
    setArpGatewayMac("");
    setArpCountEnabled(false);
    setArpCountValue("0");
    setArpBidir(true);
    setArpRestore(true);
    setArpVictimMacEnabled(false);
    setArpGatewayMacEnabled(false);

    if (selectedImage) {
      try { updateAttackArgsBefore(selectedImage, []); } catch { }
      try { updateAttackArgsAfter(selectedImage, []); } catch { }
    }
  }

  function clearAllAttackParamsExcept(keepName) {
    if (!Array.isArray(attacks)) return;
    for (const a of attacks) {
      const isKeep = a.name === keepName || a.image === keepName || a.displayName === keepName;
      if (!a.parameters) a.parameters = {};
      if (!isKeep) {
        a.parameters.argsBeforeTargets = [];
        a.parameters.argsAfterTargets = [];
      }
    }
    try {
      if (typeof attacksModel !== "undefined") {
        for (const b of attacksModel) {
          const isKeep = b.name === keepName || b.image === keepName || b.displayName === keepName;
          b.parameters = b.parameters || {};
          if (!isKeep) {
            b.parameters.argsBeforeTargets = [];
            b.parameters.argsAfterTargets = [];
          }
        }
      }
    } catch { }
  }

  const toggleAttack = (val) => {
    const requestedImage = val;
    clearAllAttackParamsExcept(requestedImage);

    try {
      const def = getAttackDefinition(requestedImage);
      if (def) {
        rebuildArgs(def.name || requestedImage);
      }
    } catch (e) { console.warn("pre-rebuildArgs failed:", e); }

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
            try { updateAttackArgsBefore(currName, []); } catch (e) { }
            try { updateAttackArgsAfter(currName, []); } catch (e) { }
          }
        } catch (e) { }
        resetAllParamStates();
        setAttackLoaded(false);
        return machinesReset;
      }

      if (!val) {
        try {
          const currName = selectedImage || null;
          if (currName) {
            try { updateAttackArgsBefore(currName, []); } catch (e) { }
            try { updateAttackArgsAfter(currName, []); } catch (e) { }
          }
        } catch (e) { }
        resetAllParamStates();
        setAttackLoaded(false);
        return machinesReset;
      }

      const attackerDomain = currAttacker?.interfaces?.if?.[0]?.eth?.domain;
      let cleanIps = extractTargetIPs(targets, attackerDomain, { allowOtherDomains: true });

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

      // Se ARP: usa SOLO il primo IP (vittima)
      if (isArpAttack(attackDef)) cleanIps = cleanIps.slice(0, 1);

      // Ping: usa i token calcolati; altrimenti prendi dal modello
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
      } else if (isArpAttack(attackDef)) {
        before = getArpBeforeTokens();
      } else {
        before = normalizeParamTokens(params.argsBeforeTargets);
      }

      let after = normalizeParamTokens(params.argsAfterTargets);

      const args = [];
      if (entrypoint) args.push(String(entrypoint));
      args.push(String(scriptPath));
      for (const token of before) args.push(String(token));
      for (const ip of cleanIps) args.push(String(ip)); // ARP: vittima posizionale
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
      rebuildArgs(requestedImage);
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
          <AttackSelector type="mitm" attacker={attacker} attacks={attacks} selectedImage={selectedImage} setSelectedImage={setSelectedImage} isLoading={isLoading} handleRefresh={handleRefresh} />
        </div>
      </div>

      <div className="grid gap-2">
        {selectedImage ? (
          (() => {
            const def = getAttackDefinition(selectedImage);
            if (!def) return <div className="text-xs text-foreground">Selected attack definition not found.</div>;

            // ===== UI per ARP SPOOFING =====
            if (isArpAttack(def)) {
              return (
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-end gap-x-10 gap-y-4 mt-1">
                    <div className="flex items-end gap-2">
                      <Checkbox isSelected={arpIfaceEnabled} isDisabled>
                        <span className="font-mono text-xs whitespace-nowrap">iface</span>
                      </Checkbox>
                      <Input
                        type="text"
                        size="sm"
                        value={arpIface}
                        onChange={(e) => setArpIface(e.target.value)}
                        onBlur={() => selectedImage && rebuildArgs(selectedImage)}
                        className="max-w-[220px]"
                        placeholder="es. eth0"
                        isDisabled={!arpIfaceEnabled}
                      />
                    </div>

                    <div className="flex items-end gap-2">
                      <Checkbox isSelected={arpGatewayEnabled} isDisabled>
                        <span className="font-mono text-xs whitespace-nowrap">gateway</span>
                      </Checkbox>
                      <Input
                        type="text"
                        size="sm"
                        value={arpGateway}
                        onChange={(e) => setArpGateway(e.target.value)}
                        onBlur={() => selectedImage && rebuildArgs(selectedImage)}
                        className="max-w-[220px]"
                        placeholder="es. 192.168.1.1"
                        isDisabled={!arpGatewayEnabled}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-x-10 gap-y-4 mt-1">
                    <div className="flex items-end gap-2">
                      <Checkbox
                        isSelected={arpVictimMacEnabled}
                        onValueChange={(v) => { setArpVictimMacEnabled(Boolean(v)); selectedImage && rebuildArgs(selectedImage); }}
                      >
                        <span className="font-mono text-xs whitespace-nowrap">victim mac</span>
                      </Checkbox>
                      <Input
                        type="text"
                        size="sm"
                        value={arpVictimMac}
                        onChange={(e) => setArpVictimMac(e.target.value)}
                        onBlur={() => selectedImage && rebuildArgs(selectedImage)}
                        className="max-w-[220px]"
                        placeholder="aa:bb:cc:dd:ee:ff"
                        isDisabled={!arpVictimMacEnabled}
                      />
                    </div>

                    <div className="flex items-end gap-2">
                      <Checkbox
                        isSelected={arpGatewayMacEnabled}
                        onValueChange={(v) => { setArpGatewayMacEnabled(Boolean(v)); selectedImage && rebuildArgs(selectedImage); }}
                      >
                        <span className="font-mono text-xs whitespace-nowrap">gateway mac</span>
                      </Checkbox>
                      <Input
                        type="text"
                        size="sm"
                        value={arpGatewayMac}
                        onChange={(e) => setArpGatewayMac(e.target.value)}
                        onBlur={() => selectedImage && rebuildArgs(selectedImage)}
                        className="max-w-[220px]"
                        placeholder="aa:bb:cc:dd:ee:ff"
                        isDisabled={!arpGatewayMacEnabled}
                      />
                    </div>
                  </div>

                  <div className="flex items-end gap-3">
                    <Checkbox
                      isSelected={arpCountEnabled}
                      onValueChange={(v) => { setArpCountEnabled(Boolean(v)); selectedImage && rebuildArgs(selectedImage); }}
                    >
                      <span className="font-mono text-xs whitespace-nowrap">count (seconds)</span>
                    </Checkbox>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      size="sm"
                      label="default 5s"
                      value={arpCountValue}
                      onChange={(e) => setArpCountValue(e.target.value)}
                      onBlur={() => selectedImage && rebuildArgs(selectedImage)}
                      isDisabled={!arpCountEnabled}
                      placeholder="default 5"
                      className="max-w-[160px]"
                    />
                  </div>

                  <div className="flex items-center gap-6">
                    <Checkbox
                      isSelected={arpBidir}
                      onValueChange={(v) => { setArpBidir(Boolean(v)); selectedImage && rebuildArgs(selectedImage); }}
                    >
                      <span className="font-mono text-xs">bidirectional</span>
                    </Checkbox>

                    <Checkbox
                      isSelected={arpRestore}
                      onValueChange={(v) => { setArpRestore(Boolean(v)); selectedImage && rebuildArgs(selectedImage); }}
                    >
                      <span className="font-mono text-xs">restore (unchecked = --no-restore)</span>
                    </Checkbox>
                  </div>


                </div>
              );
            }



            // default: textbox generica
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

export default MITM;