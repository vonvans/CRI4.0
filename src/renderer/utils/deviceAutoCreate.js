/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
import { v4 as uuidv4 } from 'uuid';
import { backboneModel } from '../models/model.js';

// Scenario files that belong to the physics simulator (not to a peripheral).
export const MAIN_CONFIGS = ['simulation.json', 'gateway.json', 'visualization.json'];

// The single, always-present physics simulator machine.
export const PHYS_SIM_NAME = 'physical_simulator';
export const PHYS_SIM_DOMAIN = 'PHYSSIM';
export const PHYS_SIM_IP = '10.2.0.1';
export const PHYS_SIM_SUBNET = '/24';
export const NETSTREAM_PORT = '8082';

// Network the peripherals expose Modbus on (reachable by PLC/SCADA).
export const DEFAULT_INDUSTRIAL_DOMAIN = 'A';
export const DEFAULT_INDUSTRIAL_SUBNET = '10.0.0.0/24';

export function sanitizeName(name) {
  return String(name || '')
    .replace(/\.json$/i, '')
    .replace(/[^\w.-]/g, '_');
}

function decodeContent(content) {
  if (!content) return null;
  try {
    const b64 = String(content).split(';base64,').pop();
    return JSON.parse(atob(b64));
  } catch (e) {
    return null;
  }
}

/**
 * Splits the configs uploaded on a device machine into the main scenario
 * configs (physics simulator) and the peripheral configs (one machine each).
 */
export function parseDeviceConfigs(machine) {
  const configs = machine?.device?.configs || [];
  const main = [];
  const peripherals = [];
  for (const cfg of configs) {
    if (!cfg?.name || !cfg?.content) continue;
    if (MAIN_CONFIGS.includes(cfg.name)) {
      main.push(cfg);
    } else {
      peripherals.push({
        name: sanitizeName(cfg.name),
        entry: cfg,
        config: decodeContent(cfg.content),
      });
    }
  }
  return { main, peripherals };
}

// A device machine becomes the "holder" of the scenario when the user uploads
// configs on it. Auto-created machines carry an explicit role so they are never
// treated as holders themselves.
export function isHolderDevice(machine) {
  return (
    machine?.type === 'device' &&
    machine?.device?.role !== 'physical-sim' &&
    machine?.device?.role !== 'peripheral' &&
    Array.isArray(machine.device?.configs) &&
    machine.device.configs.length > 0
  );
}

export function isPhysicalSim(machine) {
  return machine?.type === 'device' && machine?.device?.role === 'physical-sim';
}

export function isPeripheral(machine) {
  return machine?.type === 'device' && machine?.device?.role === 'peripheral';
}

// Industrial collision domain used by the peripherals for Modbus: reuse the
// holder's first user interface (if any), otherwise the default "A".
function findIndustrialDomain(holder) {
  const ifaces = holder?.interfaces?.if || [];
  const found = ifaces.find(
    (i) =>
      i?.eth?.domain &&
      i.eth.domain !== '_collector' &&
      i.eth.domain !== PHYS_SIM_DOMAIN
  );
  return found ? found.eth.domain : DEFAULT_INDUSTRIAL_DOMAIN;
}

// Next free host in the industrial subnet (scans every machine already using it).
function nextIndustrialIp(machines, domain, subnet = DEFAULT_INDUSTRIAL_SUBNET) {
  const [net, cidr] = subnet.split('/');
  const base = net.split('.').slice(0, 3).join('.');
  let max = 1;
  for (const m of machines) {
    for (const i of m?.interfaces?.if || []) {
      if (i?.eth?.domain !== domain || !i?.ip) continue;
      const ip = String(i.ip).split('/')[0];
      if (!ip.startsWith(`${base}.`)) continue;
      const host = parseInt(ip.split('.')[3], 10);
      if (!Number.isNaN(host) && host > max) max = host;
    }
  }
  return `${base}.${max + 1}/${cidr || 24}`;
}

export function getPhysSimIp(physMachine) {
  const iface = (physMachine?.interfaces?.if || []).find(
    (i) => i?.eth?.domain === PHYS_SIM_DOMAIN && i?.ip
  );
  return iface ? String(iface.ip).split('/')[0] : PHYS_SIM_IP;
}

function buildPhysicalSim(existing, mainConfigs) {
  const configs = mainConfigs.map((c) => ({ ...c }));
  if (existing) {
    return {
      ...existing,
      type: 'device',
      device: { ...(existing.device || {}), role: 'physical-sim', configs },
      interfaces: ensurePhysSimInterface(existing.interfaces),
    };
  }
  return {
    id: uuidv4(),
    ...backboneModel,
    type: 'device',
    name: PHYS_SIM_NAME,
    device: { role: 'physical-sim', configs },
    interfaces: {
      counter: 1,
      if: [
        {
          eth: { number: 0, domain: PHYS_SIM_DOMAIN },
          ip: `${PHYS_SIM_IP}${PHYS_SIM_SUBNET}`,
          name: '',
        },
      ],
      free: '',
    },
  };
}

function ensurePhysSimInterface(interfaces) {
  // Drop blank placeholder interfaces (no domain AND no IP): they would turn
  // into non-sequential eth numbers after toNetkitFormat renumbering, making
  // Kathara fail with "Interface N missing on device <name>".
  const ifs = (interfaces?.if || []).filter((i) => i?.eth?.domain || i?.ip);
  if (ifs.some((i) => i?.eth?.domain === PHYS_SIM_DOMAIN)) {
    return { ...interfaces, if: ifs, counter: ifs.length };
  }
  return {
    counter: ifs.length + 1,
    if: [
      ...ifs,
      {
        eth: { number: ifs.length, domain: PHYS_SIM_DOMAIN },
        ip: `${PHYS_SIM_IP}${PHYS_SIM_SUBNET}`,
        name: '',
      },
    ],
    free: interfaces?.free || '',
  };
}

function buildPeripheral(existing, peripheral, physIfaceIp, industrialDomain, industrialIp) {
  const base = existing || { id: uuidv4(), ...backboneModel, name: peripheral.name };
  // Reuse the user's configured interfaces, dropping blank placeholders and
  // ensuring the PHYSSIM interface (netstream to the physics simulator) exists.
  const meaningfulIfs = (existing?.interfaces?.if || []).filter((i) => i?.eth?.domain || i?.ip);
  let interfaces;
  if (meaningfulIfs.length > 0) {
    const hasPhys = meaningfulIfs.some((i) => i?.eth?.domain === PHYS_SIM_DOMAIN);
    interfaces = {
      counter: meaningfulIfs.length + (hasPhys ? 0 : 1),
      if: hasPhys
        ? meaningfulIfs
        : [
            ...meaningfulIfs,
            {
              eth: { number: meaningfulIfs.length, domain: PHYS_SIM_DOMAIN },
              ip: physIfaceIp,
              name: '',
            },
          ],
      free: existing.interfaces?.free || '',
    };
  } else {
    interfaces = {
      counter: 2,
      if: [
        {
          eth: { number: 0, domain: industrialDomain },
          ip: industrialIp || '',
          name: '',
        },
        {
          eth: { number: 1, domain: PHYS_SIM_DOMAIN },
          ip: physIfaceIp,
          name: '',
        },
      ],
      free: '',
    };
  }

  return {
    ...base,
    type: 'device',
    name: base.name || peripheral.name,
    device: {
      ...(base.device || {}),
      role: 'peripheral',
      configs: [{ name: peripheral.entry.name, content: peripheral.entry.content }],
    },
    interfaces,
  };
}

/**
 * Pure reconciliation of the "device" machines:
 *  - every device machine with uploaded configs is the holder of the scenario;
 *  - a single `physical_simulator` device machine is kept (subnet 10.2.x.x);
 *  - one peripheral device machine is kept per peripheral config, with its
 *    interface pointing at the physical_simulator network.
 *
 * Returns the same array reference when nothing changed, so callers can use it
 * inside setMachines without triggering infinite render loops.
 */
export function syncDeviceMachines(machines) {
  if (!Array.isArray(machines)) return machines;

  const holders = machines.filter(isHolderDevice);

  if (holders.length === 0) {
    const cleaned = machines.filter(
      (m) => !(isPhysicalSim(m) || isPeripheral(m))
    );
    return cleaned.length === machines.length ? machines : cleaned;
  }

  const holder = holders[0];
  const { main, peripherals } = parseDeviceConfigs(holder);
  const result = [...machines];

  // 1. Physical simulator (always present).
  let physIdx = result.findIndex((m) => isPhysicalSim(m) || m.name === PHYS_SIM_NAME);
  if (physIdx === -1) {
    result.push(buildPhysicalSim(null, main));
    physIdx = result.length - 1;
  } else {
    result[physIdx] = buildPhysicalSim(result[physIdx], main);
  }

  const physIp = getPhysSimIp(result[physIdx]);
  const industrialDomain = findIndustrialDomain(holder);

  // 2. One peripheral machine per peripheral config.
  const desiredNames = new Set(peripherals.map((p) => p.name));
  const newPeripheralIds = new Set();
  peripherals.forEach((peripheral, idx) => {
    const physIfaceIp = `10.2.0.${idx + 2}${PHYS_SIM_SUBNET}`;
    let pIdx = result.findIndex(
      (m) => m.type === 'device' && m.name === peripheral.name && isPeripheral(m)
    );
    if (pIdx === -1) {
      pIdx = result.findIndex(
        (m) =>
          m.type === 'device' &&
          m.name === peripheral.name &&
          !isPhysicalSim(m) &&
          !isHolderDevice(m)
      );
    }
    if (pIdx === -1) {
      const industrialIp = nextIndustrialIp(result, industrialDomain);
      const peripheralMachine = buildPeripheral(
        null,
        peripheral,
        physIfaceIp,
        industrialDomain,
        industrialIp
      );
      newPeripheralIds.add(peripheralMachine.id);
      result.push(peripheralMachine);
    } else {
      result[pIdx] = buildPeripheral(result[pIdx], peripheral, physIfaceIp, industrialDomain);
    }
  });

  // 3. Drop auto-created peripherals whose config disappeared.
  const cleaned = result.filter((m) => !(isPeripheral(m) && !desiredNames.has(m.name)));

  // 4. Auto-discover the peripherals from PLCs and SCADAs on the same
  // industrial network: they expose the Modbus servers PLC/SCADA poll. This
  // happens when a peripheral is first created or when the controller has no
  // explicit selection yet, so a manual (non-empty) selection is respected.
  const discovered = cleaned.map((m) => {
    if (m.type !== 'plc' && m.type !== 'scada') return m;
    const domain = m.interfaces?.if?.[0]?.eth?.domain;
    if (!domain) return m;
    const sameDomainPeripherals = cleaned.filter(
      (p) => isPeripheral(p) && p.interfaces?.if?.[0]?.eth?.domain === domain
    );
    if (sameDomainPeripherals.length === 0) return m;

    const current = Array.isArray(m.industrial?.monitored_machines)
      ? m.industrial.monitored_machines
      : [];
    const hasFreshSelection = current.length === 0;
    const hasNewPeripheral = sameDomainPeripherals.some((p) => newPeripheralIds.has(p.id));
    if (!hasFreshSelection && !hasNewPeripheral) return m;

    const merged = [...new Set([...current, ...sameDomainPeripherals.map((p) => p.id)])];
    if (
      merged.length === current.length &&
      merged.every((id, i) => id === current[i])
    ) {
      return m;
    }
    return {
      ...m,
      industrial: { ...(m.industrial || {}), monitored_machines: merged },
    };
  });

  try {
    if (JSON.stringify(discovered) === JSON.stringify(machines)) return machines;
  } catch (e) {
    /* fall through */
  }
  return discovered;
}