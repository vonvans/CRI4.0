/* eslint-disable radix */
/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable prefer-template */
/* eslint-disable object-shorthand */
/* eslint-disable react/prop-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/order */
/* eslint-disable prettier/prettier */
import { useState } from 'react';
import { makeGraph } from '../scripts/draw';
import Graph from 'react-graph-vis';

const GREEN = 'green';
const RED = '#C5000B';
const ORANGE = '#f1db8d';
const GRAY = 'gray';
const LGRAY = '#dddddd';
const LLGRAY = '#efefef';
const WHITE = '#fafafa';
const BLUE = '#2B7CE9';
const BLACK = '#2B1B17';

//const DIR = 'icr://images/';
import { api } from '../api';
const DIR = api.assetsUrl;

function TopologyGraph({ machines, onOpenTerminal, onOpenUI, onOpenModbusInfo, onOpenLogs, onOpenAttackStatus, onNetFlow, onValueStream, simulationRun }) {
	const [ifNameAt, setIfNameAt] = useState({ checked: false });
	const [ifOspfCost, setIfOspfCost] = useState({ checked: false });
	const [routingLabel, setRoutingLabel] = useState({ checked: false });

	const [smoothEnabled, setSmoothEnabled] = useState({
		checked: true,
		value: 'dynamic',
	});
	const [physicsEnabled, setPhysicsEnabled] = useState({
		checked: true,
		value: -1200,
	});

	const data = makeGraph(machines, ifNameAt, ifOspfCost, routingLabel);
	const [edges, setEdges] = useState(data.edges);
	const [nodes, setNodes] = useState(data.nodes);

	const graph = {
		nodes: nodes,
		edges: edges,
	};

	const options = {
		edges: {
			arrows: {
				to: { enabled: false }
			},
			smooth: {
				enabled: true,
				type: "dynamic",
				roundness: 0.5
			}
		},
		nodes: {
			scaling: {
				min: 16,
				max: 32,
			},
		},
		groups: {
			"tls_termination_proxy": { image: DIR + "tls_termination_proxy.png", shape: "image", },
			"netproxy": { image: DIR + "netproxy.png", shape: "image", },
			"mosquitto": { image: DIR + "mqtt_broker.png", shape: "image", },
			"mqtt_pub": { image: DIR + "mqtt_publisher.png", shape: "image", },
			"engine": { image: DIR + "engine.png", shape: "image", },
			"fan": { image: DIR + "fan.png", shape: "image", },
			"temperature_sensor": { image: DIR + "temperature_sensor.png", shape: "image", },
			"ngfw": {
				image: DIR + "ngfw_appliance.png",
				shape: "image",
			},
			"attacker": {
				image: DIR + "attacker.png",
				shape: "image",
			},
			"terminal": {
				image: DIR + "terminal.png",
				shape: "image",
			},
			"router": {
				image: DIR + "router.png",
				shape: "image",
			},
			"ns": {
				image: DIR + "nameserver.png",
				shape: "image",
			},
			"ws": {
				image: DIR + "webserver.png",
				shape: "image",
				value: 8
			},
			"switch": {
				image: DIR + "switch.png",
				shape: "image",
			},
			"controller": {
				image: DIR + "controller.png",
				shape: "image",
			},
			"other": {
				image: DIR + "other.png",
				shape: "image",
			},
			"scada": {
				image: DIR + "scada.png",
				shape: "image",
			},
			"plc": {
				image: DIR + "plc.png",
				shape: "image",
			},
			"conveyor": {
				image: DIR + "conveyor.png",
				shape: "image",
			},
			"laser": {
				image: DIR + "laser.png",
				shape: "image",
			},
			"rejector": {
				image: DIR + "rejector.png",
				shape: "image",
			},
			"apg": {
				image: DIR + "apg.png",
				shape: "image",
			},
			"domain": {
				color: BLACK,
				font: { color: "#dddddd" }
			},
			"eth": {
				color: WHITE,
				shape: "box"
			},
			"domain-ip": {
				color: LGRAY,
				shape: "box"
			},
			"ospf": {
				color: ORANGE,
				shape: "box"
			},
			"rip": {
				color: ORANGE,
				shape: "box"
			},
			"bgp": {
				color: ORANGE,
				shape: "box"
			}
		}
	};

	const [contextMenu, setContextMenu] = useState(null);

	const events = {
		select: function (event) {
			setContextMenu(null);
			var { nodes, edges } = event;
		},
		oncontext: function (event) {
			if (!simulationRun) return;
			const { nodes } = event;
			if (nodes.length > 0) {
				event.event.preventDefault();
				setContextMenu({
					x: event.pointer.DOM.x,
					y: event.pointer.DOM.y,
					nodeId: nodes[0]
				});
			} else {
				setContextMenu(null);
			}
		},
		click: function () {
			setContextMenu(null);
		}
	};

	const handleOpenTerminal = () => {
		if (contextMenu && onOpenTerminal) {
			onOpenTerminal(contextMenu.nodeId);
			setContextMenu(null);
		}
	};

	const handleOpenUI = () => {
		if (contextMenu && onOpenUI) {
			onOpenUI(contextMenu.nodeId);
			setContextMenu(null);
		}
	};

	const handleSaveProject = async () => {
		if (contextMenu) {
			const machineName = contextMenu.nodeId.replace("machine-", "");
			try {
				const base64Data = await api.saveScadaProject(machineName);
				if (!base64Data) {
					alert("Failed to save project or project empty");
					return;
				}
				const link = document.createElement("a");
				link.href = "data:application/octet-stream;base64," + base64Data;
				link.download = `${machineName}_project.fuxap.db`;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			} catch (e) {
				console.error(e);
				alert("Error saving project: " + e.message);
			}
			setContextMenu(null);
		}
	};

	const handleOpenModbusInfo = () => {
		if (contextMenu && onOpenModbusInfo) {
			onOpenModbusInfo(contextMenu.nodeId);
			setContextMenu(null);
		}
	};

	const handleOpenLogs = () => {
		if (contextMenu && onOpenLogs) {
			onOpenLogs(contextMenu.nodeId);
			setContextMenu(null);
		}
	};

	const handleOpenAttackStatus = () => {
		if (contextMenu && onOpenAttackStatus) {
			onOpenAttackStatus(contextMenu.nodeId);
			setContextMenu(null);
		}
	};

	const handleNetFlow = () => {
		if (contextMenu && onNetFlow) {
			onNetFlow(contextMenu.nodeId);
			setContextMenu(null);
		}
	};

	const handleValueStream = () => {
		if (contextMenu && onValueStream) {
			onValueStream(contextMenu.nodeId);
			setContextMenu(null);
		}
	};

	const showOpenUI = contextMenu && machines.find(m => {
		// Find the machine corresponding to the clicked node ID
		// Note: ID format is "machine-" + name
		const machineName = contextMenu.nodeId.replace("machine-", "");
		// Only the physics simulator device machine serves a web UI; the
		// peripherals (Modbus) do not.
		if (m.type === "device") {
			return m.name === machineName && m.device?.role === "physical-sim";
		}
		return m.name === machineName && (m.type === "plc" || m.type === "scada");
	});

	const showModbusInfo = contextMenu && machines.find(m => {
		const machineName = contextMenu.nodeId.replace("machine-", "");
		return m.name === machineName && m.type === "device";
	});

	const showSaveProject = contextMenu && machines.find(m => {
		const machineName = contextMenu.nodeId.replace("machine-", "");
		return m.name === machineName && m.type === "scada";
	});

	const showAttackStatus = contextMenu && machines.find(m => {
		const machineName = contextMenu.nodeId.replace("machine-", "");
		return m.name === machineName && m.type === "attacker";
	});

	const showValueStream = contextMenu && machines.find(m => {
		const machineName = contextMenu.nodeId.replace("machine-", "");
		return m.name === machineName && m.type === "mosquitto";
	});



	return (
		<div className="relative h-full w-full" onContextMenu={(e) => e.preventDefault()}>
			<Graph
				graph={graph}
				options={options}
				events={events}
				getNetwork={(network) => {
					// Run a quick hidden stabilization to compute good positions,
					// then freeze physics so the graph never wobbles.
					network.once('stabilized', () => {
						network.setOptions({ physics: { enabled: false } });
					});
					network.stabilize(300);
				}}
			/>
			{contextMenu && (
				<div
					className="absolute bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg rounded-md py-1 z-50 min-w-[150px]"
					style={{ top: contextMenu.y, left: contextMenu.x }}
				>
					<button
						className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
						onClick={handleOpenTerminal}
					>
						Open Terminal
					</button>
					{showOpenUI && (
						<button
							className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
							onClick={handleOpenUI}
						>
							Open UI
						</button>
					)}
					{showModbusInfo && (
						<button
							className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
							onClick={handleOpenModbusInfo}
						>
							Modbus Endpoints
						</button>
					)}
					{showSaveProject && (
						<button
							className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
							onClick={handleSaveProject}
						>
							Save Project
						</button>
					)}
					{showAttackStatus && (
						<button
							className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold border-b border-zinc-100 dark:border-zinc-700"
							onClick={handleOpenAttackStatus}
						>
							Attack Status
						</button>
					)}
					{showValueStream && (
						<button
							className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold border-b border-zinc-100 dark:border-zinc-700"
							onClick={handleValueStream}
						>
							Value Stream
						</button>
					)}
					<button
						className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
						onClick={handleOpenLogs}
					>
						Logs
					</button>
					<button
						className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
						onClick={handleNetFlow}
					>
						Net Flow
					</button>

				</div>
			)}
		</div>
	);
}

export default TopologyGraph;
