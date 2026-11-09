

export const ipRegex = /^(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\.(?:25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/;

// Actually the previous file write used:
// export const ipRegex = /^(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\.(?:25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/;
// converting to string for replace_file_content might need escaping if I use double quotes, but here I use raw string.
// simpler to just append the function.

export function computeSubnetFromIp(rawIp) {
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


export function getMachineIps(machines) {
    let collectorIpCounter = 1;
    const machineIps = {};

    machines.forEach(machine => {
        const rawName = machine.type === "attacker" ? (machine.name || "attacker") : machine.name;
        const machineName = String(rawName || "node").replace(/[^\w.-]/g, "_");
        let ip = "";

        if (machineName === "collector") {
            ip = "10.0.0.254";
        } else {
            ip = `10.0.0.${collectorIpCounter}`;
            collectorIpCounter++;
        }

        // Store by ID (machine name usually serves as ID in this system)
        machineIps[machineName] = ip;
        // Also store by original name just in case
        if (machine.name) {
            machineIps[machine.name] = ip;
        }
    });

    return machineIps;
}

export function extractTargetIPs(
    targets = [],
    attackerDomain,
    { allowOtherDomains = true } = {}  // default: includi anche altre subnet
) {
    const ips = [];
    targets.forEach((t) => {
        if (!t || !t.interfaces || !Array.isArray(t.interfaces.if)) return;

        // NEW: Check for an explicit override
        if (t.selectedInterfaceIp) {
            ips.push(t.selectedInterfaceIp);
            return;
        }

        // Filtra le interfacce escludendo quella di infrastruttura (_collector)
        const validInterfaces = t.interfaces.if.filter(
            (iface) => iface && iface.eth && iface.eth.domain !== "_collector" && iface.ip
        );

        // 1. Cerca interfacce nello stesso dominio dell'attaccante
        const sameDomainIfaces = validInterfaces.filter(
            (iface) => iface.eth.domain === attackerDomain
        );

        if (sameDomainIfaces.length > 0) {
            // 1. Se ci sono interfacce nello stesso dominio dell'attaccante, usiamo solo quelle.
            // (Ci aspettiamo solitamente una, ma ne supportiamo più di una se configurate)
            sameDomainIfaces.forEach((iface) => {
                const ipOnly = String(iface.ip).split('/')[0].trim();
                if (ipRegex.test(ipOnly)) ips.push(ipOnly);
            });
        } else if (allowOtherDomains && validInterfaces.length > 0) {
            // 2. Se non ci sono interfacce nello stesso dominio, e allowOtherDomains è true,
            // prendiamo SOLO LA PRIMA interfaccia valida disponibile (escludendo _collector).
            // Questo impedisce di avere doppioni come "10.0.1.0" se ci sono interfacce non configurate o secondarie.
            const firstValid = validInterfaces[0];
            const ipOnly = String(firstValid.ip).split('/')[0].trim();
            if (ipRegex.test(ipOnly)) ips.push(ipOnly);
        }
    });
    return Array.from(new Set(ips));
}
