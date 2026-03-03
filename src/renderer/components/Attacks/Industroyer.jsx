import { Card, CardBody, Input } from "@nextui-org/react";
import { Radio, RadioGroup } from "@nextui-org/react";
import { CheckboxGroup, Checkbox } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { FaWrench } from "react-icons/fa6";
import { FaArrowRotateLeft } from "react-icons/fa6";
import { useContext, useState, useEffect } from "react";
import { NotificationContext } from "../../contexts/NotificationContext";
import { XSymbol } from "../Symbols/XSymbol";
import { LogContext } from "../../contexts/LogContext";
import MachineSelector from "./MachineSelector";
import AttackSelector from "./AttackSelector";

function Industroyer({attacker, attacks, isLoading, machines, setMachines, handleRefresh}) {
	const [selectedImage, setSelectedImage] = useState(attacker?.attackImage || "industroyer2")
	const {setAttackLoaded} = useContext(NotificationContext);
	const [targets, setTargets] = useState(attacker?.targets || []);
	
	useEffect(() => {
		setSelectedImage(attacker?.attackImage || "industroyer2");
		setTargets(attacker?.targets || []);
	}, [attacker]);
	
	function getAttackDefinition(attackName) {
		if(!Array.isArray(attacks)) return null;
		return attacks.find(a => a.name === attackName || a.image === attackName || a.displayName === attackName) || null;
	}

	const toggleAttack = (val) => {
		if (!val) return;
		
		setMachines((prevMachines) => {
			const attackerIndex = prevMachines.findIndex(m => m.type === "attacker");
			const currentAttacker = prevMachines[attackerIndex];
			
			if (currentAttacker?.attackLoaded) {
				setAttackLoaded(false);
				return prevMachines.map(m => m.type === "attacker" ? {
					... m,
					attackLoaded: false,
					attackImage: "",
					attackCommand: "",
					attackCommandArgs: []
				} : m);
			}
			
			const attackDef = getAttackDefinition(val);
			const scriptPath = attackDef?.script || "/app/commander_cri.py";
			
			const args = ["python3", scriptPath];
			const attackCommandStr = args.join(' ');
			
			const newMachines = [...prevMachines];
			newMachines[attackerIndex] = {
				...newMachines[attackerIndex],
				attackLoaded: true,
				attackImage: val,
				attackCommandArgs: args, 
				attackCommand: attackCommandStr
			};
			
			setAttackLoaded(true);
			return newMachines;
		});
		
	};
	
	return (
		<div className="flex flex-col auto-rows-max gap-2">
            <div className="grid items-start">
                <Button isLoading={isLoading} className="bg-secondary" startContent={isLoading ? null : <FaArrowRotateLeft />} onClick={handleRefresh}>{isLoading ? "Refreshing images..." : "Refresh images"}</Button>
            </div>
            <div className="flex-grow">
                <div className="grid gap-2">
                    <MachineSelector machines={machines} setTargets={setTargets} attacker={attacker} />
                    <AttackSelector type="industroyer" attacker={attacker} attacks={attacks} selectedImage={selectedImage} setSelectedImage={setSelectedImage} isLoading={isLoading} handleRefresh={handleRefresh}/>
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
	);
}

export default Industroyer;
