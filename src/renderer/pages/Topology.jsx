/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Graph from "react-graph-vis";
import { makeGraph } from "../scripts/draw";
import { useState, useEffect, useContext, useRef } from "react";
import { Accordion, AccordionItem, Button, Card, CardBody } from "@nextui-org/react";
import { Checkbox, CheckboxGroup } from "@nextui-org/react";
import { Select, SelectItem } from "@nextui-org/react";
import { Slider } from "@nextui-org/react";
import TopologyGraph from "../components/TopologyGraph";
import TerminalModal from "../components/TerminalModal";
import UIModal from "../components/UIModal";
import PasswordModal from "../components/PasswordModal";
import { toast } from 'react-hot-toast';
import LogsModal from "../components/LogsModal";
import ModbusEndpointsModal from "../components/ModbusEndpointsModal";
import AttackStatusModal from "../components/AttackStatusModal";
import ValueStreamModal from "../components/ValueStreamModal";
import ErrorModal from "../components/ErrorModal";
import { getMachineIps } from "../utils/ipUtils";
import { isPhysicalSim, isHolderDevice } from "../utils/deviceAutoCreate";

import { api } from "../api";

import { TerminalContext } from "../contexts/TerminalContext";

function Topology() {

  const [attackInProgress, setAttackInProgress] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('attackInProgress') || 'false'); }
    catch { return false; }
  });

  // Terminal Sessions State
  const { activeTerminals, setActiveTerminals } = useContext(TerminalContext);

  // UI Modal State
  const [uiModal, setUiModal] = useState({ isOpen: false, url: "", title: "", zoom: 1 });

  // Logs Modal State
  const [logsModal, setLogsModal] = useState({ isOpen: false, containerName: "" });

  // Modbus Endpoints Modal State (device machines)
  const [modbusModal, setModbusModal] = useState({ isOpen: false, machineName: "", endpoints: [] });

  // Attack Status Modal State
  const [attackStatusModal, setAttackStatusModal] = useState({ isOpen: false, attackerName: "", isCustomAttack: false });
  const [valueStreamModal, setValueStreamModal] = useState({ isOpen: false, brokerName: "" });

  // Password Modal State
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // Error Modal State
  const [errorModalOpen, setErrorModalOpen] = useState({ isOpen: false, message: "" });

  const [machineStatuses, setMachineStatuses] = useState({});
  const pollingIntervalRef = useRef(null);

  const handleSimulationStart = async (password) => {
    setPasswordModalOpen(false);
    setShowSimulationBanner(true);
    setAttackInProgress(false);
    
    // Initialize statuses to 'pending'. Config holders are not deployed, so
    // they never signal readiness and must not block the deploy modal.
    const deployedMachines = machines.filter((m) => !isHolderDevice(m));
    const initialStatuses = {};
    deployedMachines.forEach(m => {
      initialStatuses[m.name] = 'pending';
    });
    setMachineStatuses(initialStatuses);

    try {
      await api.runSimulation(machines, labInfo, password);
      
      // Start polling for readiness
      let currentStatuses = { ...initialStatuses };
      
      pollingIntervalRef.current = setInterval(async () => {
        let allReady = true;
        const newStatuses = { ...currentStatuses };
        
        for (const machine of deployedMachines) {
          if (newStatuses[machine.name] !== 'ready') {
            try {
              const query = `{host="${machine.name}"} |= "ready"`;
              const queryParams = `query=${encodeURIComponent(query)}&limit=1`;
              const data = await api.queryLokiLogs(queryParams);
              if (data.status === 'success' && data.data && data.data.result && data.data.result.length > 0) {
                newStatuses[machine.name] = 'ready';
              } else {
                allReady = false;
              }
            } catch (err) {
              allReady = false;
            }
          }
        }
        
        currentStatuses = newStatuses;
        setMachineStatuses(newStatuses);
        
        if (allReady) {
          clearInterval(pollingIntervalRef.current);
          setTimeout(() => {
            setShowSimulationBanner(false);
            setSimulationRun(true);
            setStopSimulation(false);
          }, 1000);
        }
      }, 1000);
      
    } catch (e) {
      console.error("Run simulation error:", e);
      const raw = String(e.message || e);
      const isNetworkError = raw.toLowerCase().includes('networkerror') || raw.toLowerCase().includes('failed to fetch');
      const isContainerNotRunning = raw.includes('is not running') || raw.includes('container') && raw.includes('not running');
      const message = isNetworkError
        ? "Cannot reach the backend server. Make sure the server is running (npm run server) and try again. If you are using a custom machine image that needs to be pulled from Docker Hub, the first start may take several minutes."
        : isContainerNotRunning
        ? `A container exited before Kathara could configure it.\n\nThis usually means the Docker image is not designed for long-running standalone use — for example, images that require a Kubernetes cluster (like nginx/nginx-ingress) or an external orchestrator will crash immediately.\n\nUse a base image like ubuntu, alpine, or debian instead.\n\nFull error:\n${raw}`
        : raw;
      setErrorModalOpen({ isOpen: true, message });
      toast.error("Simulation failed.");
      setShowSimulationBanner(false);
    }
  };

  const handleCancelSimulation = async () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setShowSimulationBanner(false);
    toast("Deployment cancelled. Stopping infrastructure...", { icon: 'ℹ️' });
    await handleStopSimulation();
  };

  const [simulationRun, setSimulationRun] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('simulationRun') || 'false'); }
    catch { return false; }
  });
  const [stopSimulation, setStopSimulation] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('stopSimulation') || 'false'); }
    catch { return false; }
  });

  useEffect(() => {
    const storedSimulationRun = JSON.parse(sessionStorage.getItem('simulationRun') || 'false');
    const storedStopSimulation = JSON.parse(sessionStorage.getItem('stopSimulation') || 'false');

    if (storedSimulationRun && storedStopSimulation) {
      // Inconsistent state: simulation was running but also stopped. Reset both.
      setSimulationRun(false);
      setStopSimulation(false);
      sessionStorage.setItem('simulationRun', 'false');
      sessionStorage.setItem('stopSimulation', 'false');
    }
  }, []);

  const [showSimulationBanner, setShowSimulationBanner] = useState(false);



  const [labInfo, setLabInfo] = useState(() => {
    const savedLab = localStorage.getItem("labInfo");
    return savedLab ? JSON.parse(savedLab) : { name: "default-lab" };
  });


  useEffect(() => {
    sessionStorage.setItem('simulationRun', JSON.stringify(simulationRun));
  }, [simulationRun]);

  useEffect(() => {
    sessionStorage.setItem('stopSimulation', JSON.stringify(stopSimulation));
  }, [stopSimulation]);

  useEffect(() => {
    sessionStorage.setItem('attackInProgress', JSON.stringify(attackInProgress));
  }, [attackInProgress]);








  const [machines, setMachines] = useState(() => {
    const savedMachines = localStorage.getItem("machines");
    return savedMachines ? JSON.parse(savedMachines) : [];
  });







  const simulateAttack = async (nodeId) => {
    let attacker;

    if (nodeId && typeof nodeId === "string") {
      const machineName = nodeId.replace("machine-", "");
      attacker = machines.find((m) => m.name === machineName);
    } else {
      attacker = machines.find((m) => m.type === "attacker");
    }

    console.log("simulateAttack triggered");
    console.log("attacker:", attacker);

    if (!attacker) {
      console.warn("⚠️ No attacker machine found.");
      return;
    }

    if (!attacker.attackLoaded && !attacker.customAttackId) {
      console.warn("⚠️ Attack not loaded on attacker.");
      return;
    }

    const targetContainer = attacker.name;

    // Custom attacks: launch /attack.sh in background, log to /attack.log
    if (attacker.customAttackId) {
      try {
        await api.simulateAttack(targetContainer, ["sh", "-c", "bash -c '. /root/.cri_env; . /attack.sh' > /attack.log 2>&1 & echo $! > /attack.pid"]);
        setAttackInProgress(true);
        toast.success("Custom attack started. Check Attack Status for live output.");
      } catch (e) {
        toast.error("Failed to start custom attack: " + e.message);
      }
      return;
    }

    // Preferiamo usare attackCommandArgs (array). Se non esiste, facciamo fallback
    const commandArgs =
      Array.isArray(attacker.attackCommandArgs) && attacker.attackCommandArgs.length > 0
        ? attacker.attackCommandArgs
        : (typeof attacker.attackCommand === 'string'
          ? attacker.attackCommand.trim().split(/\s+/)
          : []);

    if (!Array.isArray(commandArgs) || commandArgs.length === 0) {
      console.warn("⚠️ Nessun comando valido da inviare al main.");
      return;
    }

    console.log("✅ Launching attack args:", commandArgs);

    // Long-running attacks (e.g. MQTT eavesdropping) launch in the background and
    // return immediately; keep the button in "Stop Attack" state until the user
    // stops them explicitly.
    const isLongRunning =
      typeof attacker.attackImage === "string" &&
      attacker.attackImage.includes("mqtt-eavesdropping");

    setAttackInProgress(true);

    try {
      const output = await api.simulateAttack(targetContainer, commandArgs);
      console.log("Attack output:", output);
      if (output) {
        toast.success(
          <div>
            <b>Attack executed:</b>
            <pre className="text-xs mt-1 whitespace-pre-wrap max-h-40 overflow-auto">{output}</pre>
          </div>,
          { duration: 5000 }
        );
      } else {
        toast.success("Attack command sent (no output returned).");
      }
      if (!isLongRunning) setAttackInProgress(false);

    } catch (e) {
      console.error("Attack error", e);
      toast.error("Attack failed: " + e.message);
      setAttackInProgress(false);
    }
  };

  const stopAttack = async (nodeId) => {
    let attacker;
    if (nodeId && typeof nodeId === "string") {
      const machineName = nodeId.replace("machine-", "");
      attacker = machines.find((m) => m.name === machineName);
    } else {
      attacker = machines.find((m) => m.type === "attacker");
    }

    if (!attacker) return;
    const targetContainer = attacker.name;

    // Custom attacks: kill by stored PID
    if (attacker.customAttackId) {
      try {
        await api.simulateAttack(targetContainer, ["sh", "-c", "kill $(cat /attack.pid 2>/dev/null) 2>/dev/null; rm -f /attack.pid"]);
        setAttackInProgress(false);
        toast.success("Custom attack stopped.");
      } catch (e) {
        toast.error("Failed to stop custom attack: " + e.message);
      }
      return;
    }

    // Standard attacks: kill known processes
    const stopCmd = [
      "sh",
      "-c",
      "sudo nft delete table ip nat 2>/dev/null || true; while pgrep ettercap > /dev/null; do pkill -9 ettercap; sleep 0.5; done; pkill -f modbus_server.py || true; kill $(cat /attack.pid 2>/dev/null) 2>/dev/null || true; rm -f /attack.pid; pkill -f fluent-bit 2>/dev/null || true; pkill -f mosquitto_sub 2>/dev/null || true",
    ];

    try {
      await api.simulateAttack(targetContainer, stopCmd);
      toast.success("Attack stopped (processes key processes killed).");
      setAttackInProgress(false);
    } catch (e) {
      console.error("Stop attack error", e);
      toast.error("Failed to stop attack: " + e.message);
    }
  };



  // Resolve the container IP reachable from the host (same logic as onOpenUI)
  const resolveContainerIp = async (machineName) => {
    let ip = "127.0.0.1";
    const inspectData = await api.getContainerInspect(machineName);
    if (inspectData && inspectData.length > 0) {
      const settings = inspectData[0].NetworkSettings;
      if (settings.Networks) {
        for (const key of Object.keys(settings.Networks)) {
          const net = settings.Networks[key];
          if (net.IPAddress) {
            ip = net.IPAddress;
            if (key === 'bridge') break;
          }
        }
      }
    }
    return ip;
  };

  // Build the list of Modbus endpoints exposed by a device machine:
  // one entry per uploaded peripheral config (its modbus_bind sets the port).
  const getDeviceModbusEndpoints = (machine, ip) => {
    const MAIN_CONFIGS = ["simulation.json", "gateway.json", "visualization.json"];
    const configs = (machine.device?.configs || []).filter(
      (c) => c?.name && c?.content && !MAIN_CONFIGS.includes(c.name)
    );

    // The physics simulator only serves the scenario configs, no Modbus.
    if (isPhysicalSim(machine)) return [];

    // No uploads → the default scenario baked into icr/device is running
    if (configs.length === 0) {
      return [
        {
          name: "temp_sensor", deviceType: "TempSensor", address: `${ip}:1502`,
          variables: [{ name: "reactor_temp", register: 100, kind: "input" }],
        },
        {
          name: "valve_actuator", deviceType: "ValveActuator", address: `${ip}:1503`,
          variables: [
            { name: "target_pos", register: 200, kind: "holding" },
            { name: "actual_pos", register: 201, kind: "holding" },
          ],
        },
      ];
    }

    const endpoints = [];
    for (const cfg of configs) {
      try {
        const b64 = String(cfg.content).split(";base64,").pop();
        const json = JSON.parse(atob(b64));
        if (!json.modbus_bind) continue;
        const port = String(json.modbus_bind).split(":").pop();
        const variables = Object.entries(json.variables || {})
          .filter(([, v]) => v?.modbus)
          .map(([varName, v]) => ({
            name: varName,
            register: v.modbus.address,
            kind: v.modbus.kind || "",
          }));
        endpoints.push({
          name: cfg.name.replace(/\.json$/i, ""),
          deviceType: json.device_type || "unknown",
          address: `${ip}:${port}`,
          variables,
        });
      } catch (e) {
        console.error(`Failed to parse device config ${cfg.name}`, e);
      }
    }
    return endpoints;
  };

  const handleStopSimulation = async () => {
    setStopSimulation(true);
    setAttackInProgress(false);
    try {
      await api.stopSimulation();
    } catch (e) {
      console.error("Stop simulation error:", e);
    } finally {
      setSimulationRun(false);
    }
  };



  return (
    <div className="grid min-h-[calc(100vh-4rem)] gap-2 p-4">
      <div className="grid h-[calc(100vh-10rem)] items-center">
        <div className="bg-white h-full rounded-xl">
          {machines.every((m) => m.name === "") && (
            <div className="grid place-items-center h-full">
              <h1 className="text-background">No machines</h1>
            </div>
          ) || (
              <div className="h-full">
                <TopologyGraph
                  machines={machines}
                  simulationRun={simulationRun}
                  onOpenTerminal={(nodeId) => {
                    setActiveTerminals((prev) => {
                      const existing = prev.find(t => t.nodeId === nodeId);
                      if (existing) {
                        return prev.map(t => t.nodeId === nodeId ? { ...t, minimized: false } : t);
                      } else {
                        return [...prev, { nodeId, minimized: false }];
                      }
                    });
                  }}
                  onOpenUI={async (nodeId) => {
                    // machine-name -> name
                    const machineName = nodeId.replace("machine-", "");
                    const machine = machines.find((m) => m.name === machineName);
                    if (!machine) return;

                    // The physics simulator is the only device machine with a
                    // web UI (port 8080); peripherals only serve Modbus.
                    if (machine.type === "device" && !isPhysicalSim(machine)) return;

                    // OLD LOGIC (internal IP):
                    // const machineIps = getMachineIps(machines);
                    // const ip = machineIps[machineName];

                    try {
                      // NEW LOGIC: Fetch runtime IP from Docker
                      // Note: Kathara usually names containers as kathara_<user>_<hash>_<machineName>...
                      // but we can try searching by the image or just pass the machine name
                      // assuming the backend logic locates the correct container (it does ancestor/name lookup).

                      const inspectData = await api.getContainerInspect(machineName);
                      // inspectData is an array [ { ... } ]

                      let ip = "127.0.0.1";

                      if (inspectData && inspectData.length > 0) {
                        const settings = inspectData[0].NetworkSettings;
                        // Determine which network IP to use. 
                        // Usually 'bridge' is the one accessible from host if exposed, 
                        // or the specific kathara network if using a routed setup.
                        // However, Kathara often maps ports to localhost. 

                        // If we want the container IP reachable from host (linux), 
                        // we generally look for the IP in 'bridge' or the main network.
                        // Let's try to find an IPAddress in any network that isn't empty.

                        if (settings.Networks) {
                          const netKeys = Object.keys(settings.Networks);
                          for (const key of netKeys) {
                            const net = settings.Networks[key];
                            if (net.IPAddress) {
                              ip = net.IPAddress;
                              // Prefer 'bridge' if available as it's the default docker network
                              if (key === 'bridge') break;
                            }
                          }
                        }
                      }

                      console.log(`Resolved IP for ${machineName}: ${ip}`);

                      let port = "80"; // Default
                      if (machine.type === "plc") port = "8080";
                      if (machine.type === "scada") port = "1881";
                      if (machine.type === "device") port = "8080"; // physics-sim web UI

                      const url = `http://${ip}:${port}`;
                      setUiModal({
                        isOpen: true,
                        url,
                        title: `${machineName} (${machine.type})`,
                        zoom: machine.type === "plc" ? 0.8 : 1
                      });
                    } catch (e) {
                      console.error("Failed to resolve container IP", e);
                      // Fallback or alert?
                      if (e.message && (e.message.includes('permission denied') || e.message.includes('docker group'))) {
                        toast.error("Docker permission denied. System fix required (see instructions).");
                      }
                      // For now maybe default to localhost if fail
                      const url = `http://127.0.0.1:8080`; // generic fallback
                      setUiModal({
                        isOpen: true,
                        url,
                        title: `${machineName} (${machine.type}) - (IP Resolve Failed)`,
                        zoom: machine.type === "plc" ? 0.8 : 1
                      });
                    }
                  }}
                  onOpenModbusInfo={async (nodeId) => {
                    const machineName = nodeId.replace("machine-", "");
                    const machine = machines.find((m) => m.name === machineName);
                    if (!machine) return;

                    // Use the IP configured on the machine's interfaces in the
                    // Home page (the address the other lab machines use), not
                    // the Docker bridge IP.
                    const configuredIface = (machine.interfaces?.if || []).find(
                      (i) => i && i.eth && i.eth.domain !== "_collector" && i.ip
                    );
                    let ip = configuredIface
                      ? String(configuredIface.ip).split("/")[0].trim()
                      : null;

                    if (!ip) {
                      // No interface configured: fall back to the runtime Docker IP
                      try {
                        ip = await resolveContainerIp(machineName);
                      } catch (e) {
                        console.error("Failed to resolve container IP", e);
                        ip = "127.0.0.1";
                      }
                    }

                    setModbusModal({
                      isOpen: true,
                      machineName,
                      endpoints: getDeviceModbusEndpoints(machine, ip),
                    });
                  }}
                  onOpenLogs={(nodeId) => {
                    const machineName = nodeId.replace("machine-", "");
                    setLogsModal({ isOpen: true, containerName: machineName });
                  }}
                  onOpenAttackStatus={(nodeId) => {
                    const machineName = nodeId.replace("machine-", "");
                    const m = machines.find(m => m.name === machineName || m.type === "attacker");
                    setAttackStatusModal({ isOpen: true, attackerName: machineName, isCustomAttack: !!m?.customAttackId });
                  }}
                  onValueStream={(nodeId) => {
                    const machineName = nodeId.replace("machine-", "");
                    setValueStreamModal({ isOpen: true, brokerName: machineName });
                  }}
                  onNetFlow={async (nodeId) => {
                    const machineName = nodeId.replace("machine-", "");
                    const machine = machines.find((m) => m.name === machineName);

                    // Collect every IP the machine is configured with (lab
                    // collision-domain IPs from Home + any auto-assigned eth0),
                    // stripped of the netmask. Arkime `ip ==` matches src or dst,
                    // so these cover inbound, outbound and forwarded traffic.
                    const ips = [];
                    if (machine) {
                      for (const iface of machine.interfaces?.if || []) {
                        if (iface?.ip) ips.push(String(iface.ip).split("/")[0].trim());
                      }
                      if (machine.computedEth0Ip) ips.push(String(machine.computedEth0Ip).split("/")[0].trim());
                      if (machine.selectedInterfaceIp) ips.push(String(machine.selectedInterfaceIp).split("/")[0].trim());
                    }

                    try {
                      const url = await api.arkimeNetFlow(ips);
                      setUiModal({
                        isOpen: true,
                        url,
                        title: `Net Flow — ${machineName}`,
                        zoom: 1,
                        hideArkimeNav: true,
                      });
                    } catch (e) {
                      console.error("Failed to open net flow", e);
                      toast.error("Failed to open net flow: " + (e.message || e));
                    }
                  }}
                  onStartAttack={(nodeId) => simulateAttack(nodeId)}
                  onStopAttack={(nodeId) => stopAttack(nodeId)}
                />
              </div>
            )}
        </div>
      </div>
      <div className="grid gap-2 items-start">
        {/* Run Simulation */}
        <Button
          isDisabled={
            simulationRun ||
            (machines.some((m) => m.type === "attacker") && !machines.find((m) => m.type === "attacker")?.attackLoaded)
          }
          className="bg-success text-white"
          onClick={() => setPasswordModalOpen(true)}
        >
          Run Simulation
        </Button>

        {/* Explain why Run Simulation is blocked when an attacker has no attack loaded */}
        {!simulationRun &&
          machines.some((m) => m.type === "attacker") &&
          !machines.find((m) => m.type === "attacker")?.attackLoaded && (
            <p className="text-xs text-warning-400 -mt-1 px-1">
              An attacker is present but has no attack loaded. Load an attack in its{" "}
              <span className="font-semibold">Attack</span> section to enable Run Simulation.
            </p>
          )}

        {/* Start/Stop Attack */}
        {!attackInProgress ? (
          <Button
            isDisabled={!machines.find(m => m.type === 'attacker')?.attackLoaded || !simulationRun || stopSimulation}
            className="bg-danger text-white"
            onClick={() => simulateAttack()}
          >
            Start Attack
          </Button>
        ) : (
          <Button
            className="bg-danger/50 text-white"
            onClick={() => stopAttack()}
          >
            Stop Attack
          </Button>
        )}

        {/* Stop Simulation */}
        {simulationRun && !stopSimulation && (
          <Button
            size="sm"
            className="bg-warning text-white"
            onClick={handleStopSimulation}
          >
            Stop Simulation
          </Button>
        )}
      </div>

      {showSimulationBanner && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-900 text-warning px-6 py-4 rounded-xl shadow-lg w-96 text-center space-y-4">
            <p className="text-sm font-bold uppercase tracking-wide">
              Deploying infrastructure
            </p>
            
            <div className="text-left space-y-2 bg-gray-800 p-4 rounded-lg mt-2 mb-2 max-h-60 overflow-y-auto">
              {machines.filter(m => !isHolderDevice(m)).map(m => (
                <div key={m.name} className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">{m.name} ({m.type || 'node'})</span>
                  <span>{machineStatuses[m.name] === 'ready' ? '🟢' : '🟡'}</span>
                </div>
              ))}
            </div>

            <p className="text-xs">Waiting for all nodes to be ready...</p>

            <div className="w-full bg-warning/20 rounded-full h-2 overflow-hidden">
              <div
                className="bg-warning h-2 animate-pulse"
                style={{ width: `100%` }}
              />
            </div>

            <div className="pt-2">
              <Button size="sm" color="danger" variant="light" onPress={handleCancelSimulation}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* <div className="">
                    <Accordion variant="splitted">
                        <AccordionItem key="1" aria-label="lab-info" title="Controls">
                            <span className="text-foreground text-large" data-open="true">Controls</span>
                            <div className="grid grid-cols-3">
                                <div className="grid gap-2 justify-items-center">
                                    <h1>Edges smoothness</h1>
                                    <Checkbox defaultSelected onValueChange={(value) => setSmoothEnabled({checked: value})}>Enabled</Checkbox>
                                    <Select
                                        label="Type"
                                        className="max-w-xs"
                                        defaultSelectedKeys={["dynamic"]}
                                        onChange={(e) => setSmoothEnabled({value: e.target.value})}
                                    >
                                        <SelectItem key="dynamic">Dynamic</SelectItem>
                                        <SelectItem key="continuous">Continuous</SelectItem>
                                        <SelectItem key="discrete">Discrete</SelectItem>
                                        <SelectItem key="diagonalCross">DiagonalCross</SelectItem>
                                        <SelectItem key="straightCross">StraightCross</SelectItem>
                                        <SelectItem key="horizontal">Horizontal</SelectItem>
                                        <SelectItem key="vertical">Vertical</SelectItem>
                                        <SelectItem key="curvedCW">CurvedCW</SelectItem>
                                        <SelectItem key="curvedCCW">CurvedCCW</SelectItem>
                                        <SelectItem key="cubicBezier">CubicBezier</SelectItem>
                                    </Select>
                                </div>
                                <div className="grid gap-2 justify-items-center">
                                    <h1>Physics</h1>
                                    <Checkbox defaultSelected onValueChange={(value) => setPhysicsEnabled({checked: value})}>Enabled</Checkbox>
                                    <Slider
                                        size="lg"
                                        step={100}
                                        color="foreground"
                                        label="Temperature"
                                        showSteps={true}
                                        maxValue={0}
                                        minValue={-30000}
                                        defaultValue={-1200}
                                        className="max-w-md"
                                    />
                                </div>
                                <div className="grid gap-2 justify-items-center">
                                    <h1>Miscellaneous</h1>
                                    <CheckboxGroup>
                                        <Checkbox value="ifNameAt" onValueChange={(value) => setIfNameAt({checked: value})}>Replace interface name with "@"</Checkbox>
                                        <Checkbox value="ifOspfCost" onValueChange={(value) => setIfOspfCost({checked: value})}>Show OSPF interface cost</Checkbox>
                                        <Checkbox value="routingLabel" onValueChange={(value) => setRoutingLabel({checked: value})}>Show OSPF/RIP/BGP label on router</Checkbox>
                                    </CheckboxGroup>
                                </div>
                            </div>
                        </AccordionItem>
                    </Accordion>
                </div> */}
      {activeTerminals.map(term => (
        <TerminalModal
          key={term.nodeId}
          isVisible={!term.minimized}
          onMinimize={() => {
            setActiveTerminals(prev => prev.map(t => t.nodeId === term.nodeId ? { ...t, minimized: true } : t));
          }}
          onClose={() => {
            setActiveTerminals(prev => prev.filter(t => t.nodeId !== term.nodeId));
          }}
          containerName={term.nodeId}
        />
      ))}
      <UIModal
        isOpen={uiModal.isOpen}
        onClose={() => setUiModal({ ...uiModal, isOpen: false })}
        url={uiModal.url}
        title={uiModal.title}
        zoom={uiModal.zoom}
        hideArkimeNav={uiModal.hideArkimeNav}
      />
      <LogsModal
        isOpen={logsModal.isOpen}
        onClose={() => setLogsModal({ ...logsModal, isOpen: false })}
        containerName={logsModal.containerName}
      />
      <ModbusEndpointsModal
        isOpen={modbusModal.isOpen}
        onClose={() => setModbusModal({ ...modbusModal, isOpen: false })}
        machineName={modbusModal.machineName}
        endpoints={modbusModal.endpoints}
      />
      <AttackStatusModal
        isOpen={attackStatusModal.isOpen}
        onClose={() => setAttackStatusModal({ ...attackStatusModal, isOpen: false })}
        attackerName={attackStatusModal.attackerName}
        isCustomAttack={attackStatusModal.isCustomAttack}
      />
      <ValueStreamModal
        isOpen={valueStreamModal.isOpen}
        onClose={() => setValueStreamModal({ ...valueStreamModal, isOpen: false })}
        brokerName={valueStreamModal.brokerName}
      />
      <PasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSubmit={handleSimulationStart}
      />
      <ErrorModal
        isOpen={errorModalOpen.isOpen}
        onClose={() => setErrorModalOpen({ ...errorModalOpen, isOpen: false })}
        message={errorModalOpen.message}
      />
    </div>
  );
}

export default Topology;
