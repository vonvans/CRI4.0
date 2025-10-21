/* eslint-disable radix */
/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable prefer-template */
/* eslint-disable object-shorthand */
/* eslint-disable react/prop-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/order */
/* eslint-disable prettier/prettier */
import { useState } from "react";
import { makeGraph } from "../scripts/draw";
import Graph from "react-graph-vis";

const GREEN = "green";
    const RED = "#C5000B";
    const ORANGE = "#f1db8d";
    const GRAY = "gray";
    const LGRAY = "#dddddd";
    const LLGRAY = "#efefef";
    const WHITE = "#fafafa";
    const BLUE = "#2B7CE9";
    const BLACK = "#2B1B17";

const DIR = "icr://images/";

function TopologyGraph({machines}) {
    const [ifNameAt, setIfNameAt] = useState({checked: false})
    const [ifOspfCost, setIfOspfCost] = useState({checked: false})
    const [routingLabel, setRoutingLabel] = useState({checked: false})

    const [smoothEnabled, setSmoothEnabled] = useState({checked: true, value: "dynamic"})
    const [physicsEnabled, setPhysicsEnabled] = useState({checked: true, value: -1200})

    const data = makeGraph(machines, ifNameAt, ifOspfCost, routingLabel)
    const [edges, setEdges] = useState(data.edges);
    const [nodes, setNodes] = useState(data.nodes)

    const graph = {
        nodes: nodes,
        edges: edges
    }

    const options = {
		nodes: {
			scaling: {
				min: 16,
				max: 32
			}
		},
		edges: {
            arrows: {
                to: { enabled: false },  // Disable the arrow at the 'to' end
                from: { enabled: false }, // Disable the arrow at the 'from' end
              },
      smooth: {
        type: "dynamic"
      },
			color: BLACK
		},
		physics: {
			enabled: true,
			barnesHut: { gravitationalConstant: -1200 }
		},
    interaction: {
      multiselect: true
    },
		groups: {
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

      const events = {
        select: function(event) {
          var { nodes, edges } = event;
        }
      };

    return (
        <Graph
            graph={graph}
            options={options}
            events={events}
            getNetwork={network => {
                let edges = {};
                let physics = {};

                if (smoothEnabled.checked) {
                    edges = {
                        smooth: {
                            type: smoothEnabled.value,
                        },
                    };
                } else {
                    edges = {
                        smooth: false,
                    };
                }

                if (physicsEnabled.checked) {
                    physics = {
                    enabled: true,
                        barnesHut: {
                            gravitationalConstant: parseInt(physicsEnabled.value),
                        },
                    };
                } else {
                    physics = {
                        enabled: false,
                    };
                }
                network.setOptions({ edges, physics });
            }}
        />
    )
}

export default TopologyGraph;
