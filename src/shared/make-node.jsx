// src/shared/make-node.js
import AdmZip from "adm-zip";

/** ───────────────── Helpers identici al renderer (adattati a Node) ───────────────── */

function makeMachineFolders(netkit, lab) {
  for (let machine of netkit) lab.folders.push(machine.name);
}

/*function makeStartupFiles(netkit, lab) {
  lab.file["collector.startup"] = "";
  lab.file["collectordb.startup"] = "";
  for (let machine of netkit) {
    //if (machine.name && machine.name !== "") {
      //lab.file[machine.name + ".startup"] = "";
    //}
     const rawName = machine.type === "attacker" ? "attacker" : machine.name;
    const machineName = String(rawName).replace(/[^\w.-]/g, "_");

    // prendi lo script dal nuovo campo, fallback al vecchio
    const userScript =
      (machine.scripts && typeof machine.scripts.startup === "string"
        ? machine.scripts.startup
        : "") ||
      (machine.interfaces && typeof machine.interfaces.free === "string"
        ? machine.interfaces.free
        : "");

    // header sicuro + script utente (trim) + newline finale
    const header = `#!/bin/bash
set -euo pipefail

`;
    const body = (userScript || "").trim();
    lab.file[`${machineName}.startup`] = header + ipSetup + body + "\n";

  }
}*/

function makeStartupFiles(netkit, lab) {
  lab.file["collector.startup"] = "";
  lab.file["collector.startup"] = "";
  lab.file["collectordb.startup"] = "";
  let ipCounter = 1;
  for (let machine of netkit) {
    const rawName = machine.type === "attacker" ? "attacker" : machine.name;
    const machineName = String(rawName || "node").replace(/[^\w.-]/g, "_");

    // prendi lo script dal nuovo campo, fallback al vecchio
    const userScript =
      (machine.scripts && typeof machine.scripts.startup === "string"
        ? machine.scripts.startup
        : "") ||
      (machine.interfaces && typeof machine.interfaces.free === "string"
        ? machine.interfaces.free
        : "");

    // header sicuro
    let header = "#!/bin/bash\nset -euo pipefail\n\n";
    let ipSetup = "";
    // Collector escluso, assegna IP incrementale su eth1
    if (machineName !== "collector") {
      ipSetup = `ip addr add 20.0.0.${ipCounter}/24 dev eth1\nip link set eth1 up\n`;
      ipCounter++;
    }
    const body = (userScript || "").trim();

    // Per tutte le macchine (tranne collector) aggiungiamo la configurazione di rete
    // usando l'IP ricavato da machine.interfaces.if[...] (prima interfaccia con ip non vuoto).
    // Se non troviamo IP, usiamo un fallback.
    let netcfg = "";
    if (machine.type !== "collector") {
      // ricava ip dalla prima interfaccia definita con ip
      let ipRaw = "";
      try {
        if (machine.interfaces && Array.isArray(machine.interfaces.if)) {
          const ipEntry = machine.interfaces.if.find((iface) => {
            return iface && typeof iface.ip === "string" && iface.ip.trim() !== "";
          });
          if (ipEntry) {
            ipRaw = String(ipEntry.ip).trim();
          }
        }
      } catch (e) {
        // ignore e fallback più sotto
      }

      // fallback statico se non troviamo nulla
      const finalIp = ipRaw && ipRaw.length > 0 ? ipRaw : "192.168.10.100/24";

      netcfg = `
# Configurazione rete aggiunta automaticamente (saltata per collector)
# Usato per macchina: ${machineName}
# Indirizzo IP selezionato: ${finalIp}
ip addr add "${finalIp}" dev eth0
ip link set eth0 up

`;
    } else {
      // (opzionale) se vuoi un commento esplicito per i collector
      netcfg = `
# Collector: configurazione IP automatica SKIPPED for ${machineName}
`;
    }

    // compone il file startup: header + body + netcfg
    lab.file[`${machineName}.startup`] = header + ipSetup + (body ? body + "\n\n" : "") + netcfg;
  }
}

/* -------------------- LAB CONF -------------------- */

function makeLabInfo(info, lab) {
  if (info) {
    lab.file["lab.conf"] = "";
    if (info.description && info.description !== "")
      lab.file["lab.conf"] += `LAB_DESCRIPTION="${info.description}"\n`;
    if (info.version && info.version !== "")
      lab.file["lab.conf"] += `LAB_VERSION="${info.version}"\n`;
    if (info.author && info.author !== "")
      lab.file["lab.conf"] += `LAB_AUTHOR="${info.author}"\n`;
    if (info.email && info.email !== "")
      lab.file["lab.conf"] += `LAB_EMAIL="${info.email}"\n`;
    if (info.web && info.web !== "")
      lab.file["lab.conf"] += `LAB_WEB="${info.web}"\n`;
    if (lab.file["lab.conf"] !== "") lab.file["lab.conf"] += "\n";
  }
}

function makeLabConfFile(netkit, lab) {
  if (!lab.file["lab.conf"]) lab.file["lab.conf"] = "";

  //lab.file["lab.conf"] += "collector[bridged]=true\n";
  //lab.file["lab.conf"] += 'collector[port]="1337:80"\n';
  
  //QUESTA NON NA RIMESSA
  // collector[0]=_collector → vedi bug #230, quindi non lo aggiungiamo
  
  //lab.file["lab.conf"] += "collector[image]=icr/collector\n";
  //lab.file["lab.conf"] += "collectordb[0]=_collector\n";
  //lab.file["lab.conf"] += "collectordb[image]=icr/collector-db\n";


  lab.file["lab.conf"] += "collector[bridged]=true\n";
  lab.file["lab.conf"] += 'collector[port]="3100:3100"\n';
  lab.file["lab.conf"] += 'collector[0]="_collector"\n';
  lab.file["lab.conf"] += "collector[image]=\"icr/collector\"\n";
  lab.file["collector.startup"] = `#!/bin/sh
  ip addr add 20.0.0.254/24 dev eth0
  ip link set eth0 up
  echo "nameserver 8.8.8.8" > /etc/resolv.conf
  loki -config.file=/etc/loki/config.yml
  `;

  for (let machine of netkit) {
   // Nome “forzato” e sanificato per evitare slash ecc.
    const rawName =
      machine.type === "attacker" ? "attacker" :
      machine.name || "node";
    const machineName = String(rawName).replace(/[^\w.-]/g, "_");

    for (let machineInterface of machine.interfaces.if) {
      if (
        machineInterface.eth.number == 0 &&
        (machine.type == "controller" || machine.type == "switch")
      ) {
        machineInterface.eth.domain = "SDNRESERVED";
        //lab.file["lab.conf"] += `${machine.name}[0]=SDNRESERVED\n`;
        lab.file["lab.conf"] += `${machineName}[0]=SDNRESERVED\n`;
      } else if (machineInterface.eth.domain && machineInterface.eth.domain !== "") {
        //lab.file["lab.conf"] += `${machine.name}[${machineInterface.eth.number}]=${machineInterface.eth.domain}\n`;
        lab.file["lab.conf"] += `${machineName}[${machineInterface.eth.number}]=${machineInterface.eth.domain}\n`;
      }
    }
    // aggiunge l'interfaccia _collector come ultima
    const lastIndex = machine.interfaces.if[machine.interfaces.if.length - 1]?.eth?.number ?? -1;
    //lab.file["lab.conf"] += `${machine.name}[${lastIndex + 1}]=_collector\n`;
    lab.file["lab.conf"] += `${machineName}[${lastIndex + 1}]=_collector\n`;
    lab.file["lab.conf"] += `${machineName}[bridged]=true\n`;

    // image per tipo
    if (machine.type == "router") {
      if (machine.routingSoftware == "frr") {
        //lab.file["lab.conf"] += `${machine.name}[image]=kathara/frr`;
        lab.file["lab.conf"] += `${machineName}[image]=kathara/frr`;
      }
      if (machine.routingSoftware == "quagga") {
        //lab.file["lab.conf"] += `${machine.name}[image]=kathara/quagga`;
        lab.file["lab.conf"] += `${machineName}[image]=kathara/quagga`;
      }
    }
    if (machine.type == "terminal" || machine.type == "ws" || machine.type == "ns") {
      //lab.file["lab.conf"] += `${machine.name}[image]=icr/kathara-base`;
      lab.file["lab.conf"] += `${machineName}[image]=icr/kathara-base`;
    }
    if (machine.type == "attacker") {
      if (machine.attackLoaded && machine.attackImage != "") {
        //lab.file["lab.conf"] += `${machine.name}[image]=${machine.attackImage}`;
        lab.file["lab.conf"] += `${machineName}[image]=${machine.attackImage}`;
      } else {
        //lab.file["lab.conf"] += `${machine.name}[image]=kalilinux/kali-rolling`;
        lab.file["lab.conf"] += `${machineName}[image]=kalilinux/kali-rolling`;

      }
    }
    lab.file["lab.conf"] += "\n";
  }
}

/** ───────────────── Normalizzatore d’aiuto (se serve) ─────────────────
 * Se dal renderer arrivasse un formato semplificato, convertiamolo
 * in quello atteso da make.jsx: interfaces.if -> [{eth:{number,domain}}...]
 */
export function toNetkitFormat(machines) {
  // Se ha già interfaces.if con eth.number → lascio stare
  if (Array.isArray(machines) && machines[0]?.interfaces?.if?.[0]?.eth?.number !== undefined) {
    return machines.map(m => {
      if (m.type === "attacker") {
        return { ...m, name: "attacker" };
      }
      return m;
    });
  }

  // Se ha interfaces come lista ["A","B"] → converto
  const convertIfList = (ifs) =>
    (ifs || []).map((domain, idx) => ({ eth: { number: idx, domain } }));

  return (machines || []).map((m) => {
    const copy = {
      ...m,
      interfaces: m.interfaces?.if
        ? m.interfaces
        : { if: Array.isArray(m.interfaces) ? convertIfList(m.interfaces) : [] },
    };

    // 👇 Forziamo il nome se è un attacker
    if (copy.type === "attacker") {
      copy.name = "attacker";
    }

    return copy;
  });
}

/** ───────────────── Funzione principale: genera ZIP in outPath ───────────────── */
export async function generateZipNode(machines, labInfo, outPath) {
  const netkit = toNetkitFormat(machines);

    // 🟢 Log per controllare cosa arriva
  const attackers = (netkit || []).filter(m => m.type === "attacker");
  console.log("🧪 attackers in input:", attackers.map(a => ({
    name: a.name,
    attackImage: a.attackImage,
    type: a.type
  })));

  // lab “virtuale” come nel renderer
  const lab = { file: {}, folders: [] };

  makeMachineFolders(netkit, lab);
  makeStartupFiles(netkit, lab);
  makeLabInfo(labInfo, lab);
  makeLabConfFile(netkit, lab);

  // costruzione ZIP
  const zip = new AdmZip();

  // cartelle (vuote) per ogni macchina
  for (const folder of lab.folders) {
    // AdmZip aggiunge file; per cartelle possiamo aggiungere un file placeholder opzionale
    // ma Kathara non lo richiede: i file .startup stanno in root del lab
  }

  // file in root
  for (const [name, content] of Object.entries(lab.file)) {
    zip.addFile(name, Buffer.from(content ?? "", "utf8"));
  }

  // scrivi su disco
  zip.writeZip(outPath);
}
