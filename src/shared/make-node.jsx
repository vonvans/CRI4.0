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
  lab.file["collectordb.startup"] = "";

  // 1. Pre-calculate IPs for all machines (needed for PLC to know other machines' IPs)
  let collectorIpCounter = 1; // New counter for 10.1.0.X subnet

  for (let machine of netkit) {
    const rawName = machine.type === "attacker" ? "attacker" : machine.name;
    const machineName = String(rawName || "node").replace(/[^\w.-]/g, "_");

    // Assign IP to eth0 from 10.1.0.0/24 subnet
    let eth0Ip;
    if (machineName === "collector") {
      eth0Ip = "10.1.0.254/24"; // Dedicated IP for the collector
    } else if (machineName === "collectordb") {
      eth0Ip = "10.1.0.253/24"; // Dedicated IP for the collector DB
    } else {
      // Check if eth0 is already configured in interfaces
      const eth0Interface = machine.interfaces?.if?.find(i => i.eth?.number === 0);
      if (eth0Interface && eth0Interface.ip) {
        eth0Ip = eth0Interface.ip;
        // Ensure it has CIDR
        if (!eth0Ip.includes('/')) eth0Ip += '/24';
      } else {
        eth0Ip = `10.1.0.${collectorIpCounter}/24`;
        collectorIpCounter++;
      }
    }
    machine.computedEth0Ip = eth0Ip; // Store for later use
  }

  // 2. Generate startup files
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
    header += "echo \"nameserver 8.8.8.8\" > /etc/resolv.conf\n";
    let ipSetup = "";

    // Use pre-calculated IP
    const eth0Ip = machine.computedEth0Ip;
    ipSetup += `ip addr add ${eth0Ip} dev eth0\nip link set eth0 up\n`;

    // Assign IPs to eth1 and subsequent interfaces from frontend
    if (machine.interfaces && Array.isArray(machine.interfaces.if)) {
      for (const iface of machine.interfaces.if) {
        if (iface && iface.eth && iface.eth.number >= 1 && typeof iface.ip === "string" && iface.ip.trim() !== "") {
          const interfaceNumber = iface.eth.number;
          let ipAddress = String(iface.ip).trim();
          if (!ipAddress.includes("/")) {
            ipAddress += "/24";
          }
          ipSetup += `ip addr add ${ipAddress} dev eth${interfaceNumber}\nip link set eth${interfaceNumber} up\n`;
        }
      }
    }
    const body = (userScript || "").trim();

    // "other" machines can be any image (archlinux, alpine, custom, …)
    // Use a minimal POSIX sh script without assumptions about the image's tools.
    if (machine.type === "other") {
      let otherScript = "#!/bin/sh\n\n";
      // Best-effort: try to configure DNS and bring up interfaces, ignore failures
      otherScript += "echo 'nameserver 8.8.8.8' > /etc/resolv.conf 2>/dev/null || true\n";
      otherScript += `ip addr add ${eth0Ip} dev eth0 2>/dev/null || true\n`;
      otherScript += "ip link set eth0 up 2>/dev/null || true\n";
      if (machine.interfaces && Array.isArray(machine.interfaces.if)) {
        for (const iface of machine.interfaces.if) {
          if (iface && iface.eth && iface.eth.number >= 1 && typeof iface.ip === "string" && iface.ip.trim() !== "") {
            const interfaceNumber = iface.eth.number;
            let ipAddress = String(iface.ip).trim();
            if (!ipAddress.includes("/")) ipAddress += "/24";
            otherScript += `ip addr add ${ipAddress} dev eth${interfaceNumber} 2>/dev/null || true\n`;
            otherScript += `ip link set eth${interfaceNumber} up 2>/dev/null || true\n`;
          }
        }
      }
      if (body) otherScript += "\n" + body + "\n";
      lab.file[`${machineName}.startup`] = otherScript;
      continue;
    }

    if (machine.type === "tls_termination_proxy") {
      const { in_addr = "0.0.0.0:50000", out_addr = "10.1.0.2:50001", verify = "0" } = machine.tls || {};
      const tlsScript = `
cd /etc/stunnel
mkcert -cert-file server.crt -key-file server.key "localhost" "127.0.0.1" $(hostname -I)

tee /etc/stunnel/stunnel.conf << __EOF__
cert = /etc/stunnel/server.crt
key  = /etc/stunnel/server.key
CAfile = $(mkcert -CAROOT)/rootCA.pem

verify = ${verify}
sslVersion = TLSv1.2
options = NO_SSLv2
options = NO_SSLv3
options = NO_COMPRESSION
pid = /var/run/stunnel.pid
foreground = no
sudo nft delete table ip nat


[section]
accept = ${in_addr}
connect = ${out_addr}
__EOF__

stunnel
`;
      lab.file[`${machineName}.startup`] = header + ipSetup + tlsScript;
    } else {
      let extraCommands = "";
      if (machine.type === "engine") {
        const opMode = machine.industrial?.operationalMode || "engine";

        if (opMode === "engine") {
          // Default values matching engine.py defaults
          let args = "";
          // If properties existed in machine model, we would map them here:
          // if (machine.engine?.temperatureStep) args += ` -t ${machine.engine.temperatureStep}`;

          extraCommands += `uv run /engine.py${args} > /var/log/engine.log 2>&1 & disown\n`;
        }
      }

      if (machine.type === "plc") {
        // Add monitored machines
        if (machine.industrial?.monitored_machines && Array.isArray(machine.industrial.monitored_machines)) {
          for (const monitoredId of machine.industrial.monitored_machines) {
            const targetMachine = netkit.find(m => m.id === monitoredId);
            if (targetMachine) {
              // Determine IP address: use Industrial Network (eth1)
              let targetIp = null;
              const eth1Interface = targetMachine.interfaces?.if?.find((i) => i.eth?.number === 1);
              if (eth1Interface && eth1Interface.ip) {
                targetIp = eth1Interface.ip.split("/")[0];
              }

              if (targetIp) {
                extraCommands += `openplc-cli device add "${targetMachine.name}" "${targetIp}" "502"\n`;
              }
            }
          }
        }

        if (machine.industrial?.plcProgramName) {
          const extension = machine.industrial.plcProgramName.includes('.') ? machine.industrial.plcProgramName.split('.').pop() : 'st';
          extraCommands += `openplc-cli program add "/shared/\${HOSTNAME}.${extension}" "main" "main program"\n`;
        }

        console.log(`[DEBUG] Checking password for machine ${machine.name}:`, machine.industrial?.password);
        if (machine.industrial?.password) {
          extraCommands += `openplc-cli changeuser -u openplc -p "${machine.industrial.password}"\n`;
        }

        extraCommands += `/opt/OpenPLC_v3/start_openplc.sh\n`;
      }

      if (machine.type === "scada") {
        extraCommands += `
# SCADA Server Wrapper
COMMAND=(npm run start)
PATTERN='WebServer is running http://127.0.0.1:1881/'

FIFO=$(mktemp -u)
mkfifo "$FIFO"
"\${COMMAND[@]}" >"$FIFO" 2>&1 &
WRAPPER_PID=$!
while IFS= read -r line; do
  echo "$line"
  if [[ "$line" == *"$PATTERN"* ]]; then
    LISTENER_PID="$(ss -lptn 'sport = :1881' | sed -n 's/.*pid=\\([0-9]\\+\\).*/\\1/p' | head -n1)"
    echo "Closing listener on :1881 (PID=$LISTENER_PID), wrapper PID=$WRAPPER_PID"
    [ -n "$LISTENER_PID" ] && kill -TERM "$LISTENER_PID" 2>/dev/null || true
    kill -TERM "$WRAPPER_PID" 2>/dev/null || true
    break
  fi
done <"$FIFO"
rm -f "$FIFO"

if [ -f "/shared/\${HOSTNAME}.db" ]; then
  rm -f /usr/src/app/FUXA/server/_appdata/project.fuxap.db
  cp /shared/\${HOSTNAME}.db /usr/src/app/FUXA/server/_appdata/project.fuxap.db
fi

npm start &
`;
      }

      lab.file[`${machineName}.startup`] = header + ipSetup + (body ? body + "\n\n" : "") + extraCommands;
    }
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

  //PER UNIX POST MAC

  lab.file["lab.conf"] += "collector[bridged]=true\n";
  lab.file["lab.conf"] += 'collector[port]="3100:3100/tcp"\n';
  lab.file["lab.conf"] += 'collector[0]="_collector"\n';
  lab.file["lab.conf"] += "collector[image]=\"icr/collector\"\n";
  lab.file["collector.startup"] += '#!/bin/sh\n'
  lab.file["collector.startup"] += 'echo "nameserver 8.8.8.8" > /etc/resolv.conf\n'
  lab.file["collector.startup"] += 'loki -config.file=/etc/loki/config.yml &\n'
  lab.file["collector.startup"] += 'ip addr add 10.1.0.254/24 dev eth0\n'
  lab.file["collector.startup"] += 'ip link set eth0 up\n'

  // PER BUG MAC

  //lab.file["lab.conf"] += "collector[bridged]=true\n";
  //  lab.file["lab.conf"] += 'collector[port]="3100:3100/tcp"\n';
  //  lab.file["lab.conf"] += "collector[image]=\"icr/collector\"\n";
  //kathara lconfig -n collector --add "_collector"
  //tramite docker exec nel main, lanciare
  //ip addr add 10.1.0.254/24 dev eth1
  //ip link set eth1 up



  //flag sistema operativo mac/Windows workaround linux no 
  //solo prime due righe e quarta
  //quando partito, fare NEL MAIN lconfig .... e poi eseguire all'interno i due comandi ip addr ed ip link

  for (let machine of netkit) {
    // Nome “forzato” e sanificato per evitare slash ecc.
    const rawName =
      machine.type === "attacker" ? "attacker" :
        machine.name || "node";
    const machineName = String(rawName).replace(/[^\w.-]/g, "_");

    for (let machineInterface of machine.interfaces.if) {
      if (machineInterface.eth.number > 0 && machineInterface.eth.domain && machineInterface.eth.domain !== "") {
        lab.file["lab.conf"] += `${machineName}[${machineInterface.eth.number}]=${machineInterface.eth.domain}\n`;
      }
    }
    // aggiunge l'interfaccia _collector come ultima
    const lastIndex = machine.interfaces.if[machine.interfaces.if.length - 1]?.eth?.number ?? -1;
    //lab.file["lab.conf"] += `${machine.name}[${lastIndex + 1}]=_collector\n`;
    lab.file["lab.conf"] += `${machineName}[0]=_collector\n`;
    lab.file["lab.conf"] += `${machineName}[bridged]=true\n`;
    lab.file["lab.conf"] += `${machineName}[volume]="/lib/modules|/lib/modules|ro"\n`;

    // image per tipo
    if (machine.type == "engine") { lab.file["lab.conf"] += machine.name + "[image]=icr/engine"; }
    if (machine.type == "fan") { lab.file["lab.conf"] += machine.name + "[image]=icr/fan"; }
    if (machine.type == "temperature_sensor") { lab.file["lab.conf"] += machine.name + "[image]=icr/temperature_sensor"; }
    if (machine.type == "tls_termination_proxy") { lab.file["lab.conf"] += machine.name + "[image]=icr/tls_termination_proxy"; }
    if (machine.type == "rejector") { lab.file["lab.conf"] += machine.name + "[image]=icr/rejector"; }
    if (machine.type == "scada") { lab.file["lab.conf"] += machine.name + "[image]=icr/scada"; }
    if (machine.type == "apg") { lab.file["lab.conf"] += machine.name + "[image]=icr/apg"; }
    if (machine.type == "laser") { lab.file["lab.conf"] += machine.name + "[image]=icr/laser"; }
    if (machine.type == "conveyor") { lab.file["lab.conf"] += machine.name + "[image]=icr/conveyor"; }
    if (machine.type == "plc") { lab.file["lab.conf"] += machine.name + "[image]=icr/plc"; }
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
    if (machine.type == "other" && machine.other && machine.other.image && machine.other.image !== "") {
      lab.file["lab.conf"] += `${machineName}[image]="${machine.other.image}"`;
    }
    if (machine.type == "ngfw") {
      lab.file["lab.conf"] += `${machineName}[image]=icr/ngfw`;


      // && machine.ngfw.waf && machine.ngfw.waf.enabled
      if (machine.ngfw) {
        const listenport = machine.ngfw.listenport || "8080";
        const endpoint = machine.ngfw.endpoint || "http://10.0.1.1:8080";

        /*
        const waf = machine.ngfw.waf;
        const findtime = waf.findtime || "10m";
        const maxretry = waf.maxretry || "5";
        const bantime = waf.bantime || "1h";
        const page = waf.page || "/login";
        const http_code = waf.http_code || "200";
        const protocol = waf.protocol || "HTTP";
        const method = waf.method || "POST";
        */

        lab.file[`${machineName}.startup`] += `
        # TLS PROXY configuration
        INPUT_PORT="${listenport}"
        ENDPOINT="${endpoint}"
        
sed -i '/stream {/a  server { listen '"\${INPUT_PORT}"';  proxy_pass '"\${ENDPOINT}"'; }' /etc/nginx/nginx.conf
service nginx stop && service nginx start
        `;
      }
    }
    if (machine.type == "attacker") {
      if (machine.attackLoaded && machine.attackImage != "") {
        //lab.file["lab.conf"] += `${machine.name}[image]=${machine.attackImage}`;
        lab.file["lab.conf"] += `${machineName}[image]=${machine.attackImage}\n`;

        // Inject privileged options for ModbusTCP injection
        if (machine.attackImage.includes("modbustcp-injection")) {
          lab.file["lab.conf"] += `${machineName}[docker_options]="--privileged"\n`;
        }
      } else {
        //lab.file["lab.conf"] += `${machine.name}[image]=kalilinux/kali-rolling`;
        lab.file["lab.conf"] += `${machineName}[image]=kalilinux/kali-rolling@sha256:eb500810d9d44236e975291205bfd45e9e19b7f63859e3a72ba30ea548ddb1df`;

      }
      // Explicitly set hostname to avoid Docker utilizing image name or random string
      lab.file["lab.conf"] += `${machineName}[hostname]="attacker"\n`;
    }
    lab.file["lab.conf"] += "\n";

    // Set ENDPOINT environment variable for industrial devices (fan, temperature_sensor)
    if (machine.type === "fan" || machine.type === "temperature_sensor") {
      let endpoint = "http://localhost:8000/";

      // If an engine is selected, find its IP address
      if (machine.industrial && machine.industrial.selectedEngineId) {
        const selectedEngine = netkit.find(m => m.id === machine.industrial.selectedEngineId);
        if (selectedEngine) {
          // Prefer the auto-assigned 20.x IP (Control Network)
          if (selectedEngine.computedEth0Ip) {
            const ipWithoutMask = selectedEngine.computedEth0Ip.split("/")[0];
            endpoint = `http://${ipWithoutMask}:8000/`;
          }
          // Fallback to the first configured interface (User Network) if for some reason eth0 wasn't assigned
          else if (selectedEngine.interfaces && selectedEngine.interfaces.if && selectedEngine.interfaces.if[0]) {
            const engineIp = selectedEngine.interfaces.if[0].ip;
            if (engineIp) {
              // Remove the subnet mask (e.g., "192.168.1.1/24" -> "192.168.1.1")
              const ipWithoutMask = engineIp.split("/")[0];
              endpoint = `http://${ipWithoutMask}:8000/`;
            }
          }
        }
      }

      // Set the ENDPOINT environment variable in lab.conf
      lab.file["lab.conf"] += `${machineName}[env]="ENDPOINT=${endpoint}"\n`;

      if (machine.type === "fan") {
        const capacity = machine.industrial?.capacity || "2.0";
        lab.file["lab.conf"] += `${machineName}[env]="CAPACITY=${capacity}"\n`;
      }

      if (machine.type === "temperature_sensor") {
        if (machine.industrial?.sineWave) {
          lab.file["lab.conf"] += `${machineName}[env]="SINE_WAVE=true"\n`;
          if (machine.industrial.period) lab.file["lab.conf"] += `${machineName}[env]="SINE_PERIOD=${machine.industrial.period}"\n`;
          if (machine.industrial.amplitude) lab.file["lab.conf"] += `${machineName}[env]="SINE_AMPLITUDE=${machine.industrial.amplitude}"\n`;
          if (machine.industrial.tempOffset) lab.file["lab.conf"] += `${machineName}[env]="SINE_OFFSET=${machine.industrial.tempOffset}"\n`;
        }
      }
    }
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
      const updatedInterfaces = m.interfaces.if.map((iface, idx) => ({
        ...iface,
        eth: { ...iface.eth, number: idx + 1 } // Adjust eth.number here
      }));

      const copy = {
        ...m,
        interfaces: { ...m.interfaces, if: updatedInterfaces }
      };

      if (copy.type === "attacker") {
        copy.name = "attacker";
      }
      return copy;
    });
  }

  // Se ha interfaces come lista ["A","B"] → converto
  const convertIfList = (ifs) =>
    (ifs || []).map((iface, idx) => ({
      eth: { number: idx + 1, domain: iface.domain }, // Increment idx by 1
      ip: iface.ip // Capture the IP here
    }));

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

  // ───────────────── SHARED FILES (PLC Program etc) ─────────────────
  for (const machine of netkit) {
    if (machine.type === 'plc' && machine.industrial && machine.industrial.plcProgramContent && machine.industrial.plcProgramName) {
      const rawContent = machine.industrial.plcProgramContent.split(';base64,').pop();
      if (rawContent) {
        // Use machine name for the file, keeping the original extension
        const originalName = machine.industrial.plcProgramName;
        const extension = originalName.includes('.') ? originalName.split('.').pop() : 'st';
        const machineName = String(machine.name || "plc").replace(/[^\w.-]/g, "_");
        const newFileName = `${machineName}.${extension}`;

        // Determine if we want to save it as text or binary. Buffer.from(..., 'base64') handles it correctly.
        lab.file[`shared/${newFileName}`] = Buffer.from(rawContent, 'base64');
      }
    }


    if (machine.type === 'scada') {
      console.log(`[DEBUG] Found SCADA machine: ${machine.name}`);
      console.log(`[DEBUG] Industrial props:`, machine.industrial ? "present" : "missing");
      if (machine.industrial) {
        console.log(`[DEBUG] scadaProjectName: ${machine.industrial.scadaProjectName}`);
        // console.log(`[DEBUG] scadaProjectContent length: ${machine.industrial.scadaProjectContent?.length}`); 
      }
    }

    if (machine.type === 'scada' && machine.industrial && machine.industrial.scadaProjectContent && machine.industrial.scadaProjectName) {
      const rawContent = machine.industrial.scadaProjectContent.split(';base64,').pop();
      if (rawContent) {
        // Save as shared/<machineName>.db
        const machineName = String(machine.name || "scada").replace(/[^\w.-]/g, "_");
        const newFileName = `${machineName}.db`;

        console.log(`[DEBUG] Adding SCADA file to zip: shared/${newFileName} (length: ${rawContent.length})`);
        lab.file[`shared/${newFileName}`] = Buffer.from(rawContent, 'base64');
      } else {
        console.log(`[DEBUG] Failed to extract base64 content`);
      }
    }
  }

  // Debug: list all files in lab.file
  console.log("[DEBUG] Files in lab.file:", Object.keys(lab.file));

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
