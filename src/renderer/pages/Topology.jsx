/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Graph from "react-graph-vis";
import { makeGraph } from "../scripts/draw";
import { useState, useEffect } from "react";
import { Accordion, AccordionItem, Button, Card, CardBody } from "@nextui-org/react";
import { Checkbox, CheckboxGroup } from "@nextui-org/react";
import { Select, SelectItem } from "@nextui-org/react";
import { Slider } from "@nextui-org/react";
import TopologyGraph from "../components/TopologyGraph";
import { useContext } from "react";
import { NotificationContext } from "../contexts/NotificationContext";


function Topology() {

    const [attackInProgress, setAttackInProgress] = useState(false);
    const [showTimer, setShowTimer] = useState(false);
    const [progress, setProgress] = useState(0);

   const [simulationRun, setSimulationRun] = useState(() => {
  try { return JSON.parse(localStorage.getItem('simulationRun') || 'false'); }
  catch { return false; }
});
const [stopSimulation, setStopSimulation] = useState(() => {
  try { return JSON.parse(localStorage.getItem('stopSimulation') || 'false'); }
  catch { return false; }
});

const [showSimulationBanner, setShowSimulationBanner] = useState(false);



  const [labInfo, setLabInfo] = useState(() => {
    const savedLab = localStorage.getItem("labInfo");
    return savedLab ? JSON.parse(savedLab) : { name: "default-lab" };
  });


  useEffect(() => {
  localStorage.setItem('simulationRun', JSON.stringify(simulationRun));
}, [simulationRun]);

useEffect(() => {
  localStorage.setItem('stopSimulation', JSON.stringify(stopSimulation));
}, [stopSimulation]);


    

    useEffect(() => {
  if (attackInProgress && progress >= 100) {
    const timeout = setTimeout(() => {
      setAttackInProgress(false);
      setShowTimer(false);
      setProgress(0);
    }, 1000); // attesa finale opzionale

    return () => clearTimeout(timeout);
  }
}, [progress, attackInProgress]);

    

    const [machines, setMachines] = useState(() => {
        const savedMachines = localStorage.getItem("machines");
        return savedMachines ? JSON.parse(savedMachines) : [];
    });

    
    

    const { attackLoaded } = useContext(NotificationContext);


    const simulateAttack = async () => {
  const attacker = machines.find((m) => m.type === "attacker");
  console.log("simulateAttack triggered");
  console.log("attacker:", attacker);

  if (!attacker) {
    console.warn("⚠️ No attacker machine found.");
    return;
  }

  if (!attacker.attackLoaded) {
    console.warn("⚠️ Attack not loaded on attacker.");
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

  setAttackInProgress(true);
  setShowTimer(true);
  setProgress(0);

  // start timer/progress (comportamento originale: 4 secondi)
  let seconds = 0;
  const interval = setInterval(() => {
    seconds += 1;
    setProgress((seconds / 4) * 100); // progress in %
    if (seconds >= 4) {
      clearInterval(interval);
      setTimeout(() => {
        setShowTimer(false);
        setAttackInProgress(false);
      }, 1000); // attesa finale per chiusura pulita
    }
  }, 1000);

  try {
    await window.electron.ipcRenderer.invoke("simulate-attack", {
      container: attacker.name,
      command: commandArgs, // INVIO come ARRAY di argomenti
    });
  } catch (e) {
    console.error("Attack error", e);
    // opzionale: mostra notifica / alert a utente
  }
  // nota: lo stato (attackInProgress/showTimer) viene chiuso dal timer sopra
};

   /* const simulateAttack = async () => {
  const attacker = machines.find((m) => m.type === "attacker");
  console.log("simulateAttack triggered");
  console.log("attacker:", attacker);

  if (!attacker) {
    console.warn("⚠️ No attacker machine found.");
    return;
  }

  if (!attacker.attackLoaded) {
    console.warn("⚠️ Attack not loaded on attacker.");
    return;
  }

  // Se arrivi qui, IPC verrà chiamato
  console.log("✅ Launching attack:", attacker.attackCommand);

  setAttackInProgress(true);
  setShowTimer(true);
  setProgress(0);

  try {
    await window.electron.ipcRenderer.invoke("simulate-attack", {
      container: attacker.name,
      command: attacker.attackCommand,
    });
  } catch (e) {
    console.error("Attack error", e);
  }



  let seconds = 0;
  const interval = setInterval(() => {
    seconds += 1;
    setProgress((seconds / 4) * 100); // progress in %
    if (seconds >= 4) {
      clearInterval(interval);
      setTimeout(() => {
        setShowTimer(false);
        setAttackInProgress(false);
      }, 1000); // attesa finale per chiusura pulita
    }
  }, 1000);
};*/

  const handleStopSimulation = async () => {
  setStopSimulation(true);
  try {
    await window.electron.ipcRenderer.invoke("stop-simulation");
  } catch (e) {
    console.error("Stop simulation error:", e);
  } finally {
    setSimulationRun(false);
  }
};



    return(
        <div className="grid min-h-[calc(100vh-4rem)] gap-2 p-4">
            <div className="grid h-[calc(100vh-10rem)] items-center">
                <div className="bg-white h-full rounded-xl">
                    {machines.every((m) => m.name === "") && (
                            <div className="grid place-items-center h-full">
                                <h1 className="text-background">No machines</h1>
                            </div>
                    ) || (
                            <div className="h-full">
                                <TopologyGraph machines={machines} />
                            </div>
                    )}
                </div>
            </div>
            <div className="grid gap-2 items-start">
  {/* Run Simulation */}
  <Button 
    isDisabled={simulationRun} 
    className="bg-success text-white" 
    onClick={async () => {
  setShowSimulationBanner(true);

  try {
    await window.electron.ipcRenderer.invoke("run-simulation", {
      machines,
      labInfo,
    });
  } catch (e) {
    console.error("Run simulation error:", e);
  }

  setTimeout(() => {
    setShowSimulationBanner(false);
    setSimulationRun(true);
    setStopSimulation(false);
  }, 2000);
}}
  >
    Run Simulation
  </Button>

  {/* Simulate Attack */}
  <Button 
    isDisabled={attackInProgress || !attackLoaded || !simulationRun || stopSimulation} 
    className={attackInProgress ? "bg-danger/50 text-white" : "bg-danger text-white"} 
    onClick={simulateAttack}
  >
    {attackInProgress ? "Attack launched!" : "Simulate Attack"}
  </Button>

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
            {showTimer && (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
    <div className="bg-gray-900 text-warning px-6 py-4 rounded-xl shadow-lg w-96 text-center space-y-2">
      <p className="text-sm font-bold uppercase tracking-wide">
         Stand by, Launching attack
      </p>
      <p className="text-xs">Deployment in progress...</p>

      {/* Progress bar */}
      <div className="w-full bg-warning/20 rounded-full h-2 overflow-hidden">
        <div
          className="bg-warning h-2 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  </div>
)}
{showSimulationBanner && (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
    <div className="bg-gray-900 text-warning px-6 py-4 rounded-xl shadow-lg w-96 text-center space-y-2">
      <p className="text-sm font-bold uppercase tracking-wide">
        Deploying infrastructure
      </p>
      <p className="text-xs">Please wait...</p>

      {/* Progress bar opzionale */}
      <div className="w-full bg-warning/20 rounded-full h-2 overflow-hidden">
        <div
          className="bg-warning h-2 animate-pulse"
          style={{ width: `100%` }}
        />
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
        </div>
    );
}

export default Topology;
