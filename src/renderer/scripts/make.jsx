/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable promise/always-return */
/* eslint-disable no-undef */
/* eslint-disable no-var */
/* eslint-disable vars-on-top */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable consistent-return */
/* eslint-disable func-names */
/* eslint-disable array-callback-return */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-plusplus */
/* eslint-disable camelcase */
/* eslint-disable guard-for-in */
/* eslint-disable no-use-before-define */
/* eslint-disable spaced-comment */
/* eslint-disable no-useless-concat */
/* eslint-disable eqeqeq */
/* eslint-disable prefer-template */
/* eslint-disable prefer-const */
/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { getUsableIPs, findAvailableSubnet } from './subnet_finder';

function makeMachineFolders(netkit, lab) {
	for (let machine of netkit)
		lab.folders.push(machine.name);
}

function makeStartupFiles(netkit, lab) {
	lab.file["collector.startup"] = "";
	lab.file["collectordb.startup"] = "";
	for (let machine of netkit) {
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
		if (machine.name && machine.name != "")
			lab.file[machine.name + ".startup"] = "";
	}
}

/* -------------------------------------------------- */
/* -------------------- LAB CONF -------------------- */
/* -------------------------------------------------- */

function makeLabInfo(info, lab) {
	if (info) {
		lab.file["lab.conf"] = "";
		if (info.description && info.description != "")
			lab.file["lab.conf"] += "LAB_DESCRIPTION=\"" + info.description + "\"\n";
		if (info.version && info.version != "")
			lab.file["lab.conf"] += "LAB_VERSION=\"" + info.version + "\"\n";
		if (info.author && info.author != "")
			lab.file["lab.conf"] += "LAB_AUTHOR=\"" + info.author + "\"\n";
		if (info.email && info.email != "")
			lab.file["lab.conf"] += "LAB_EMAIL=\"" + info.email + "\"\n";
		if (info.web && info.web != "")
			lab.file["lab.conf"] += "LAB_WEB=\"" + info.web + "\"\n";
		if (lab.file["lab.conf"] != "") lab.file["lab.conf"] += "\n";
	}
}

function makeLabConfFile(netkit, lab) {
	if (!lab.file["lab.conf"])
		lab.file["lab.conf"] = "";

	lab.file["lab.conf"] += "collector[bridged]=true\n";
	lab.file["lab.conf"] += "collector[port]=\"1337:80\"\n";
	lab.file["lab.conf"] += "collector[0]=_collector\n";
	// bug: https://github.com/KatharaFramework/Kathara/issues/230
	// fix:
	// after kathara lstart
	// kathara lconfig -n collector --add _collector && kathara exec collector ip address add <ip>/<mask> dev eth1
	// where <ip> is the COLLECTOR_HOST in *.startup and <mask> is the only mask present in collectordb.startup
	lab.file["lab.conf"] += "collector[image]=icr/collector\n";
	lab.file["lab.conf"] += "collectordb[0]=_collector\n";
	lab.file["lab.conf"] += "collectordb[image]=icr/collector-db\n";

	for (let machine of netkit) {
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
		if (machine.bridged) {
			lab.file["lab.conf"] += `${machine.name}[bridged]=true\n`;
		}
		for (let machineInterface of machine.interfaces.if) {
			if (machineInterface.eth.number == 0 && (machine.type == "controller" || machine.type == "switch")) {
				machineInterface.eth.domain = "SDNRESERVED";
				lab.file["lab.conf"] += machine.name + "[0]=" + "SDNRESERVED\n";
			} else if (machineInterface.eth.domain && machineInterface.eth.domain != "") {
				lab.file["lab.conf"] += machine.name + "[" + machineInterface.eth.number + "]=" + machineInterface.eth.domain + "\n";
			}
		}
		lab.file["lab.conf"] += machine.name + "[" + (machine.interfaces.if[machine.interfaces.if.length - 1].eth.number + 1) + "]=_collector\n";
		if (machine.type == "router") {
			if (machine.routingSoftware == "frr") {
				lab.file["lab.conf"] += machine.name + "[image]=kathara/frr";
			}
			if (machine.routingSoftware == "quagga") {
				lab.file["lab.conf"] += machine.name + "[image]=kathara/quagga";
			}
		}
		if (machine.type == "terminal" || machine.type == "ws" || machine.type == "ns") {
			lab.file["lab.conf"] += machine.name + "[image]=icr/kathara-base";
		}
		if (machine.type == "other" && machine.other && machine.other.image && machine.other.image != "") {
			lab.file["lab.conf"] += machine.name + '[image]="' + machine.other.image + '"';
		}
		if (machine.type == "ngfw") {
			lab.file["lab.conf"] += machine.name + "[image]=icr/ngfw";
		}
		if (machine.type == "attacker") {
			if (machine.attackLoaded && machine.attackImage != "") {
				lab.file["lab.conf"] += machine.name + "[image]=" + machine.attackImage;
			} else {
				lab.file["lab.conf"] += machine.name + "[image]=kalilinux/kali-rolling@sha256:eb500810d9d44236e975291205bfd45e9e19b7f63859e3a72ba30ea548ddb1df";
			}
			// Explicitly set hostname
			lab.file["lab.conf"] += machine.name + '[hostname]="attacker"\n';
		}
		lab.file["lab.conf"] += "\n";
	}
}

/* --------------------------------------------------- */
/* ------------------ STARTUP FILES ------------------ */
/* --------------------------------------------------- */

// TODO: Metti a fattor comune:
/*
	for (let machine of netkit) {
if(machine.type == "engine"){ lab.file["lab.conf"] += machine.name + "[image]=icr/engine"; }
if(machine.type == "fan"){ lab.file["lab.conf"] += machine.name + "[image]=icr/fan"; }
if(machine.type == "temperature_sensor"){ lab.file["lab.conf"] += machine.name + "[image]=icr/temperature_sensor"; }
if(machine.type == "tls_termination_proxy"){ lab.file["lab.conf"] += machine.name + "[image]=icr/tls_termination_proxy"; }
if(machine.type == "rejector"){ lab.file["lab.conf"] += machine.name + "[image]=icr/rejector"; }
if(machine.type == "scada"){ lab.file["lab.conf"] += machine.name + "[image]=icr/scada"; }
if(machine.type == "apg"){ lab.file["lab.conf"] += machine.name + "[image]=icr/apg"; }
if(machine.type == "laser"){ lab.file["lab.conf"] += machine.name + "[image]=icr/laser"; }
if(machine.type == "conveyor"){ lab.file["lab.conf"] += machine.name + "[image]=icr/conveyor"; }
if(machine.type == "plc"){ lab.file["lab.conf"] += machine.name + "[image]=icr/plc"; }
		if (machine.name && machine.name != "" && .....
*/
function makeTerminal(netkit, lab) {
	for (let machine of netkit) {
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
		if (machine.name && machine.name != "" && machine.type == "terminal" && machine.pc.dns && machine.pc.dns != "-") {
			lab.folders.push(machine.name + "/etc");
			lab.file[machine.name + "/etc/resolv.conf"] = "nameserver " + machine.pc.dns + "\n";
		}
	}
}

function makeAttacker(netkit, lab) {
	for (let machine of netkit) {
		// Enforce attacker name
		if (machine.type === "attacker") machine.name = "attacker";

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
		if (machine.name && machine.name != "" && machine.type == "attacker" && machine.pc.dns && machine.pc.dns != "-") {
			lab.folders.push(machine.name + "/etc");
			lab.file[machine.name + "/etc/resolv.conf"] = "nameserver " + machine.pc.dns + "\n";
		}
		if (machine.attackLoaded && machine.attackImage != "") {
			lab.file[machine.name + ".startup"] += "\n" + machine.attackCommand + "\n";
		}
	}
}
/*-----------------------------------------*/
/*---------------- ROUTING ----------------*/
/*-----------------------------------------*/


function makeRouter(netkit, lab) {
	for (let machine of netkit) {
		if (machine.type == "engine") { lab.file["lab.conf"] += machine.name + "[image]=icr/engine"; }
		if (machine.type == "fan") { lab.file["lab.conf"] += machine.name + "[image]=icr/fan"; }
		if (machine.type == "temperature_sensor") { lab.file["lab.conf"] += machine.name + "[image]=icr/temperature_sensor"; }
		if (machine.name && machine.name != "" && machine.type == "router") {
			if (machine.routingSoftware == "frr") {
				makeRouterFrr(machine, lab);
			}
			if (machine.routingSoftware == "quagga") {
				makeRouterQuagga(machine, lab);
			}
		}
	}
}

/* --------------------------------------------------- */
/* ------------------------ FRR ---------------------- */
/* --------------------------------------------------- */

function makeRouterFrr(machine, lab) {
	// routing dinamico RIP e OSPF
	if (machine.name && machine.name != "" && machine.type == "router") {
		if (machine.routing.rip.en || machine.routing.ospf.en || machine.routing.bgp.en) {
			lab.file[machine.name + ".startup"] += "systemctl start frr\n";
			lab.folders.push(machine.name + "/etc/frr");
			lab.file[machine.name + "/etc/frr/daemons"] = "zebra=yes\n";
		}
		//inizializziamo il file frr.conf
		lab.file[machine.name + "/etc/frr/frr.conf"] = "";
		//creiamo il file di vtysh
		lab.file[machine.name + "/etc/frr/vtysh.conf"] = "service integrated-vtysh-config";
		if (machine.routing.rip.en) {
			makeRouterRipFrr(machine, lab);
		}

		if (machine.routing.ospf.en) {
			makeRouterOspfFrr(machine, lab);
		}

		if (machine.routing.bgp.en)
			makeBgpConfFrr(machine, lab);

		//nb: i costi vanno qui alla fine
		if (machine.routing.ospf.en) {
			for (let machineInterface of machine.routing.ospf.if) {
				if (machineInterface.cost != "" && machineInterface.cost) {
					lab.file[machine.name + "/etc/frr/frr.conf"] += "machineInterface eth" + machineInterface.machineInterface + "\n";
					lab.file[machine.name + "/etc/frr/frr.conf"] += "ospf cost " + machineInterface.cost + "\n";
				}
			}
		}

		//Free conf
		if (machine.routing.frr.free && machine.routing.frr.free != "") {
			lab.file[machine.name + "/etc/frr/frr.conf"] += "\n" + machine.routing.frr.free + "\n";
		}
		//nb: e infine i log
		lab.file[machine.name + "/etc/frr/frr.conf"] += "\nlog file /var/log/frr/frr.log\n";
	}
}

function makeRouterRipFrr(machine, lab) {
	lab.file[machine.name + "/etc/frr/daemons"] += "ripd=yes\n";

	lab.file[machine.name + "/etc/frr/frr.conf"] += "router rip\n";

	for (let network of machine.routing.rip.network)
		if (network && network != "")
			lab.file[machine.name + "/etc/frr/frr.conf"] += "network " + network + "\n";

	for (let route of machine.routing.rip.route) {
		if (route && route != "")
			lab.file[machine.name + "/etc/frr/frr.conf"] += "route " + route + "\n";
	}
	lab.file[machine.name + "/etc/frr/frr.conf"] += "\n";

	//nb: mantenere l'ordine
	if (machine.routing.rip.en && machine.routing.rip.connected) {
		lab.file[machine.name + "/etc/frr/frr.conf"] += "redistribute connected\n";
	}
	if (machine.routing.rip.en && machine.routing.rip.ospf) {
		lab.file[machine.name + "/etc/frr/frr.conf"] += "redistribute ospf\n";
	}
	if (machine.routing.rip.en && machine.routing.rip.bgp) {
		lab.file[machine.name + "/etc/frr/frr.conf"] += "redistribute bgp\n";
	}

	//Free conf
	if (machine.routing.rip.en && machine.routing.rip.connected) {
		if (machine.routing.rip.free && machine.routing.rip.free != "")
			lab.file[machine.name + "/etc/frr/frr.conf"] += machine.routing.rip.free + "\n";
	}
}

function makeRouterOspfFrr(machine, lab) {
	lab.file[machine.name + "/etc/frr/daemons"] += "ospfd=yes\n";
	lab.file[machine.name + "/etc/frr/frr.conf"] += "router ospf\n";
	for (let m /* non trasformare in un for... of */ in machine.routing.ospf.network) {
		if (machine.routing.ospf.network[m] && machine.routing.ospf.network[m] != "")
			lab.file[machine.name + "/etc/frr/frr.conf"] += "network " + machine.routing.ospf.network[m] + " area " + machine.routing.ospf.area[m] + "\n";
		if (machine.routing.ospf.stub[m] && machine.routing.ospf.stub[m] != "")
			lab.file[machine.name + "/etc/frr/frr.conf"] += "area " + machine.routing.ospf.area[m] + " stub\n";
	}
	lab.file[machine.name + "/etc/frr/frr.conf"] += "\n";
	if (machine.routing.ospf.en && machine.routing.ospf.connected) {
		lab.file[machine.name + "/etc/frr/frr.conf"] += "redistribute connected\n";
	}
	if (machine.routing.ospf.en && machine.routing.ospf.rip) {
		lab.file[machine.name + "/etc/frr/frr.conf"] += "redistribute rip\n";
	}
	if (machine.routing.ospf.en && machine.routing.ospf.bgp) {
		lab.file[machine.name + "/etc/frr/frr.conf"] += "redistribute bgp\n";
	}

	//Free conf
	if (machine.routing.ospf.en && machine.routing.ospf.connected) {
		if (machine.routing.ospf.free && machine.routing.ospf.free != "")
			lab.file[machine.name + "/etc/frr/frr.conf"] += machine.routing.ospf.free + "\n";
	}

}

function makeBgpConfFrr(router, lab) {
	lab.file[router.name + "/etc/frr/daemons"] += "bgpd=yes\n";

	lab.file[router.name + "/etc/frr/frr.conf"] += "debug bgp\ndebug bgp events\ndebug bgp filters\ndebug bgp fsm\ndebug bgp keepalives\ndebug bgp updates\n";
	lab.file[router.name + "/etc/frr/frr.conf"] += "router bgp " + router.routing.bgp.as + "\n\n";

	// Inserimento tutte le Network su cui annunciare BGP
	for (let network of router.routing.bgp.network) {
		if (network && network != "") {
			lab.file[router.name + "/etc/frr/frr.conf"] += "network " + network + "\n";
		}
	}

	lab.file[router.name + "/etc/frr/frr.conf"] += "\n";
	router.routing.bgp.remote.forEach(function (remote) {
		if (remote && remote.neighbor != "" && remote.as != "") {
			//Aggiungo il remote-as
			lab.file[router.name + "/etc/frr/frr.conf"] += "neighbor " + remote.neighbor + " remote-as " + remote.as + "\n";

			//Aggiungo la descrizione
			if ((remote.description) && remote.description != "") {
				lab.file[router.name + "/etc/frr/frr.conf"] += "neighbor " + remote.neighbor + " description " + remote.description + "\n";
			}
		}
	});

	//Free conf
	if (router.routing.bgp.free && router.routing.bgp.free != "")
		lab.file[router.name + "/etc/frr/frr.conf"] += router.routing.bgp.free + "\n";
}

/* ------------------------------------------------------ */
/* ------------------------ QUAGGA ---------------------- */
/* ------------------------------------------------------ */

function makeRouterQuagga(machine, lab) {
	// routing dinamico RIP e OSPF
	if (machine.name && machine.name != "" && machine.type == "router") {
		if (machine.routing.rip.en || machine.routing.ospf.en || machine.routing.bgp.en) {
			lab.file[machine.name + ".startup"] += "/etc/init.d/zebra start\n";
			lab.folders.push(machine.name + "/etc/zebra");
			lab.file[machine.name + "/etc/zebra/daemons"] = "zebra=yes\n";

			lab.file[machine.name + "/etc/zebra/zebra.conf"] = "hostname zebra\n"
				+ "password zebra\n"
				+ "enable password zebra\n"
				+ "\nlog file /var/log/zebra/zebra.log\n";
		}

		if (machine.routing.rip.en) {
			lab.file[machine.name + "/etc/zebra/daemons"] += "ripd=yes\n";

			lab.file[machine.name + "/etc/zebra/ripd.conf"] = "hostname ripd\n"
				+ "password zebra\n"
				+ "enable password zebra\n"
				+ "\n"
				+ "router rip\n";

			for (let network of machine.routing.rip.network)
				lab.file[machine.name + "/etc/zebra/ripd.conf"] += "network " + network + "\n";

			for (let route of machine.routing.rip.route) {
				if (route && route != "")
					lab.file[machine.name + "/etc/zebra/ripd.conf"] += "route " + route + "\n";
			}
			lab.file[machine.name + "/etc/zebra/ripd.conf"] += "\n";
		}

		if (machine.routing.ospf.en) {
			lab.file[machine.name + "/etc/zebra/daemons"] += "ospfd=yes\n";

			lab.file[machine.name + "/etc/zebra/ospfd.conf"] = "hostname ospfd\n"
				+ "password zebra\n"
				+ "enable password zebra\n"
				+ "\n"
				+ "router ospf\n";

			for (let m /* non trasformare in un for... of */ in machine.routing.ospf.network) {
				lab.file[machine.name + "/etc/zebra/ospfd.conf"] += "network " + machine.routing.ospf.network[m] + " area " + machine.routing.ospf.area[m] + "\n";
				if (machine.routing.ospf.stub[m])
					lab.file[machine.name + "/etc/zebra/ospfd.conf"] += "area " + machine.routing.ospf.area[m] + " stub\n";
			}
			lab.file[machine.name + "/etc/zebra/ospfd.conf"] += "\n";
		}

		if (machine.routing.bgp.en) makeBgpConfQuagga(machine, lab);

		//nb: mantenere l'ordine
		if (machine.routing.rip.en && machine.routing.rip.connected) {
			lab.file[machine.name + "/etc/zebra/ripd.conf"] += "redistribute connected\n";
		}
		if (machine.routing.ospf.en && machine.routing.ospf.connected) {
			lab.file[machine.name + "/etc/zebra/ospfd.conf"] += "redistribute connected\n";
		}
		if (machine.routing.rip.en && machine.routing.rip.ospf) {
			lab.file[machine.name + "/etc/zebra/ripd.conf"] += "redistribute ospf\n";
		}
		if (machine.routing.rip.en && machine.routing.rip.bgp) {
			lab.file[machine.name + "/etc/zebra/ripd.conf"] += "redistribute bgp\n";
		}
		if (machine.routing.ospf.en && machine.routing.ospf.rip) {
			lab.file[machine.name + "/etc/zebra/ospfd.conf"] += "redistribute rip\n";
		}
		if (machine.routing.ospf.en && machine.routing.ospf.bgp) {
			lab.file[machine.name + "/etc/zebra/ospfd.conf"] += "redistribute bgp\n";
		}

		//nb: i costi vanno qui alla fine
		if (machine.routing.ospf.en) {
			for (let machineInterface of machine.routing.ospf.if) {
				if (machineInterface.cost != "" && machineInterface.cost) {
					lab.file[machine.name + "/etc/zebra/ospfd.conf"] += "machineInterface eth" + machineInterface.machineInterface + "\n";
					lab.file[machine.name + "/etc/zebra/ospfd.conf"] += "ospf cost " + machineInterface.cost + "\n";
				}
			}
		}

		//Free conf
		if (machine.routing.ospf.en) {
			if (machine.routing.ospf.free && machine.routing.ospf.free != "")
				lab.file[machine.name + "/etc/zebra/ospfd.conf"] += "\n" + machine.routing.ospf.free + "\n";
		}
		if (machine.routing.rip.en) {
			if (machine.routing.rip.free && machine.routing.rip.free != "")
				lab.file[machine.name + "/etc/zebra/ripd.conf"] += "\n" + machine.routing.rip.free + "\n";
		}
		//nb: e infine i log
		if (machine.routing.rip.en) {
			lab.file[machine.name + "/etc/zebra/ripd.conf"] += "\nlog file /var/log/zebra/ripd.log\n";
		}
		if (machine.routing.ospf.en) {
			lab.file[machine.name + "/etc/zebra/ospfd.conf"] += "\nlog file /var/log/zebra/ospfd.log\n";
		}
	}
}

function makeBgpConfQuagga(router, lab) {
	lab.file[router.name + "/etc/zebra/daemons"] += "bgpd=yes\n";

	lab.file[router.name + "/etc/zebra/bgpd.conf"] = ""
		+ "hostname bgpd\n"
		+ "password zebra\n"
		+ "enable password zebra\n"
		+ "\n"

		// Inserimento nome AS
		+ "router bgp " + router.routing.bgp.as + "\n\n";

	// Inserimento tutte le Network su cui annunciare BGP
	for (let network of router.routing.bgp.network) {
		if (network && network != "") {
			lab.file[router.name + "/etc/zebra/bgpd.conf"] += "network " + network + "\n";
		}
	}

	lab.file[router.name + "/etc/zebra/bgpd.conf"] += "\n";

	router.routing.bgp.remote.forEach(function (remote) {
		if (remote && remote.neighbor != "" && remote.as != "") {
			//Aggiungo il remote-as
			lab.file[router.name + "/etc/zebra/bgpd.conf"] += "neighbor " + remote.neighbor + " remote-as " + remote.as + "\n";

			//Aggiungo la descrizione
			if ((remote.description) && remote.description != "") {
				lab.file[router.name + "/etc/zebra/bgpd.conf"] += "neighbor " + remote.neighbor + " description " + remote.description + "\n";
			}
		}
	});

	//Free conf
	if (router.routing.bgp.free && router.routing.bgp.free != "")
		lab.file[router.name + "/etc/zebra/bgpd.conf"] += "\n" + router.routing.bgp.free + "\n";

	lab.file[router.name + "/etc/zebra/bgpd.conf"] += "\nlog file /var/log/zebra/bgpd.log\n\n"
		+ "debug bgp\ndebug bgp events\ndebug bgp filters\ndebug bgp fsm\ndebug bgp keepalives\ndebug bgp updates\n";
}


/*-----------------------------------*/
/*----------- WEB SERVER ------------*/
/*-----------------------------------*/

function makeWebserver(netkit, lab) {
	for (let machine of netkit) {
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
		if (machine.name && machine.name != "" && machine.type == "ws") {
			if (machine.ws.userdir == true) {
				lab.folders.push(machine.name + "/var/www/html");
				lab.file[machine.name + "/var/www/html/index.html"] = "<html><head><title>Hello World!</title></head><body>Hello World!</body></html>";
				lab.file[machine.name + ".startup"] += "a2enmod userdir\n";
			}
			lab.file[machine.name + ".startup"] += "systemctl start apache2\n";
		}
	}
}

/* ------------------------------------------------------- */
/* ------------------ AUX FUNCTIONS -----------------------*/
/* ------------------------------------------------------- */

function makeStaticRouting(netkit, lab) {
	let networks = [];
	for (let machine of netkit) {
		if (machine.type == "engine") { lab.file["lab.conf"] += machine.name + "[image]=icr/engine"; }
		if (machine.type == "fan") { lab.file["lab.conf"] += machine.name + "[image]=icr/fan"; }
		if (machine.type == "temperature_sensor") { lab.file["lab.conf"] += machine.name + "[image]=icr/temperature_sensor"; }
		for (let machineInterface of machine.interfaces.if) {
			if (machineInterface.ip && machineInterface.ip != "") {
				networks.push(machineInterface.ip);
			}
		}
	}
	console.log(netkit.length)
	console.log(networks)
	// const availableSubnet = findAvailableSubnet(networks, netkit.length + 2);
	// const availableSubnet = findAvailableSubnet(networks, netkit.length + 2);
	const availableSubnet = "10.1.0.0/24";
	console.log(availableSubnet);
	let availableIPs = getUsableIPs(availableSubnet);
	console.log(availableIPs);

	let collector_host = "10.1.0.254";
	availableIPs = availableIPs.filter(ip => ip !== collector_host && ip !== "10.1.0.253");

	let collector_db = "10.1.0.253";

	lab.file["collector.startup"] += "echo \"nameserver 8.8.8.8\" > /etc/resolv.conf\n";
	lab.file["collector.startup"] += "ip address add " + collector_host + "/" + availableSubnet.split("/")[1] + " dev eth0\n";
	lab.file["collector.startup"] += "COLLECTORDB_HOST=" + collector_db + " /app/collector\n";
	lab.file["collectordb.startup"] += "echo \"nameserver 8.8.8.8\" > /etc/resolv.conf\n";
	lab.file["collectordb.startup"] += "ip address add " + collector_db + "/" + availableSubnet.split("/")[1] + " dev eth0\n";

	let switchCounter = 2;
	for (let machine of netkit) {
		if (machine.type == "engine") { lab.file["lab.conf"] += machine.name + "[image]=icr/engine"; }
		if (machine.type == "fan") { lab.file["lab.conf"] += machine.name + "[image]=icr/fan"; }
		if (machine.type == "temperature_sensor") { lab.file["lab.conf"] += machine.name + "[image]=icr/temperature_sensor"; }
		if (machine.name && machine.name != "") {
			lab.file[machine.name + ".startup"] += "echo \"nameserver 8.8.8.8\" > /etc/resolv.conf\n";
			for (let machineInterface of machine.interfaces.if) {
				if (machineInterface.eth.number == 0) {
					if (machine.type == "switch") {
						machineInterface.ip = "192.168.100." + switchCounter++ + "/24";	// TODO: E se non bastassero 200+ switch?
					} else if (machine.type == "controller") {
						machineInterface.ip = "192.168.100.1/24";
					}
				}
				if (machineInterface.eth.domain && machineInterface.eth.domain != "" && machineInterface.ip && machineInterface.ip != "") {
					lab.file[machine.name + ".startup"] += "ip address add " + machineInterface.ip + " dev eth" + machineInterface.eth.number + "\n";
				}
			}

			lab.file[machine.name + ".startup"] += "ip address add " + availableIPs.shift() + "/" + availableSubnet.split("/")[1] + " dev eth" + (machine.interfaces.if[machine.interfaces.if.length - 1].eth.number + 2) + "\n";
			if (machine.name != "attacker")
				lab.file[machine.name + ".startup"] += "COLLECTOR_HOST=" + collector_host + " /bin/bash /root/collector_client.sh &\n";

			for (let gateway of machine.gateways.gw) {
				if (gateway.gw && gateway.gw != "") {
					if (gateway.route == "") {
						lab.file[machine.name + ".startup"] += "ip route add 0.0.0.0/0 via " + gateway.gw + " dev eth" + gateway.if + "\n";
					}
					else {
						lab.file[machine.name + ".startup"] += "ip route add " + gateway.route + " via " + gateway.gw + " dev eth" + gateway.if + "\n";
					}
				}
			}

			if (machine.interfaces.free && machine.interfaces.free != "")
				lab.file[machine.name + ".startup"] += "\n" + machine.interfaces.free + "\n";
		}
	}
}

function makeOther(netkit, lab) {
	for (let machine of netkit) {
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
		if (machine.name && machine.name != "" && machine.type == "other" && machine.other.image) {
			lab.file["lab.conf"] += machine.name + '[image]="' + machine.other.image + '"\n';
			// Replace the startup generated by makeStaticRouting with a portable POSIX sh
			// script so any image (archlinux, alpine, ubuntu, custom registry) works.
			const userScript = (machine.scripts && typeof machine.scripts.startup === 'string'
				? machine.scripts.startup
				: '') || (machine.interfaces && typeof machine.interfaces.free === 'string'
					? machine.interfaces.free
					: '');
			let otherStartup = '#!/bin/sh\n\n';
			otherStartup += "echo 'nameserver 8.8.8.8' > /etc/resolv.conf 2>/dev/null || true\n";
			for (let machineInterface of machine.interfaces.if) {
				if (machineInterface.ip && machineInterface.ip != '') {
					otherStartup += 'ip addr add ' + machineInterface.ip + ' dev eth' + machineInterface.eth.number + ' 2>/dev/null || true\n';
					otherStartup += 'ip link set eth' + machineInterface.eth.number + ' up 2>/dev/null || true\n';
				}
			}
			if (userScript && userScript.trim() !== '') {
				otherStartup += '\n' + userScript.trim() + '\n';
			}
			lab.file[machine.name + '.startup'] = otherStartup;
			for (let file of machine.other.files) {
				lab.file["/etc/scripts/" + file.name] = file.contents;
			}
		}
	}
}

/*---------------------------------------------*/
/*---------- INDUSTRIAL DEVICES CONFIG --------*/
/*---------------------------------------------*/

function makeIndustrialDevices(netkit, lab) {
	for (let machine of netkit) {
		if (machine.type == "engine") { lab.file["lab.conf"] += machine.name + "[image]=icr/engine\n"; }
		if (machine.type == "fan") { lab.file["lab.conf"] += machine.name + "[image]=icr/fan\n"; }
		if (machine.type == "temperature_sensor") { lab.file["lab.conf"] += machine.name + "[image]=icr/temperature_sensor\n"; }

		if (machine.name && machine.name != "" && (machine.type == "fan" || machine.type == "temperature_sensor")) {
			let endpoint = "http://localhost:8000/";

			// If an engine is selected, find its IP address
			if (machine.industrial && machine.industrial.selectedEngineId) {
				const selectedEngine = netkit.find(m => m.id === machine.industrial.selectedEngineId);
				if (selectedEngine && selectedEngine.interfaces && selectedEngine.interfaces.if && selectedEngine.interfaces.if[0]) {
					const engineIp = selectedEngine.interfaces.if[0].ip;
					if (engineIp) {
						// Remove the subnet mask (e.g., "192.168.1.1/24" -> "192.168.1.1")
						const ipWithoutMask = engineIp.split("/")[0];
						endpoint = `http://${ipWithoutMask}:8000/`;
					}
				}
			}

			// Set the ENDPOINT environment variable in lab.conf
			lab.file["lab.conf"] += machine.name + `[env]="ENDPOINT=${endpoint}"\n`;

			if (machine.type === "temperature_sensor") {
				if (machine.industrial && machine.industrial.sineWave) {
					lab.file["lab.conf"] += machine.name + `[env]="SINE_WAVE=true"\n`;
					if (machine.industrial.period) lab.file["lab.conf"] += machine.name + `[env]="SINE_PERIOD=${machine.industrial.period}"\n`;
					if (machine.industrial.amplitude) lab.file["lab.conf"] += machine.name + `[env]="SINE_AMPLITUDE=${machine.industrial.amplitude}"\n`;
					if (machine.industrial.tempOffset) lab.file["lab.conf"] += machine.name + `[env]="SINE_OFFSET=${machine.industrial.tempOffset}"\n`;
				}
			}
		}
	}
}

function makeNGFW(netkit, lab) {
	for (let machine of netkit) {
		if (machine.type === "ngfw") {
			console.log("[DEBUG] Checking NGFW machine:", machine.name);
			console.log("[DEBUG] machine.ngfw:", JSON.stringify(machine.ngfw));
		}

		if (machine.type == "engine") { lab.file["lab.conf"] += machine.name + "[image]=icr/engine"; }
		if (machine.type == "fan") { lab.file["lab.conf"] += machine.name + "[image]=icr/fan"; }
		if (machine.type == "temperature_sensor") { lab.file["lab.conf"] += machine.name + "[image]=icr/temperature_sensor"; }

		// WAF rules (array)
		if (machine.type === "ngfw" && machine.ngfw && Array.isArray(machine.ngfw.wafRules)) {
			for (const waf of machine.ngfw.wafRules) {
				console.log("[DEBUG] Generating WAF rule for", machine.name);
				const endpoint = waf.endpoint || "http://10.0.1.1:8080";
				const findtime = waf.findtime || "10m";
				const maxretry = waf.maxretry || "5";
				const bantime = waf.bantime || "1h";
				const page = waf.page || "/login";
				const http_code = waf.http_code || "200";
				const protocol = waf.protocol || "HTTP";
				const method = waf.method || "POST";

				lab.file[machine.name + ".startup"] += `
# WAF Configuration
ENDPOINT="${endpoint}"
FINDTIME="${findtime}"
MAXRETRY="${maxretry}"
BANTIME="${bantime}"
PAGE="${page}"
HTTP_CODE="${http_code}"
PROTOCOL="${protocol}"
METHOD="${method}"


# Install dependencies if needed (though already in image)
# apt update & apt install -y sudo nginx-full fail2ban fluent-bit

#------MAIN--------------------
sudo tee /etc/nginx/conf.d/proxy_8080.conf <<'EOF'
server {
    listen 8080;
    server_name _;

    location / {
        proxy_pass __ENDPOINT__;

        proxy_http_version 1.1;

        # header importanti
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # websocket / keepalive compat
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }
}
EOF
sudo sed -i "s|__ENDPOINT__|$ENDPOINT|g" /etc/nginx/conf.d/proxy_8080.conf
sudo rm /etc/nginx/sites-enabled/default

sudo systemctl enable --now nginx
sudo systemctl reload nginx || sudo service nginx reload

# ---- FAIL2BAN
sudo systemctl enable --now fail2ban

sudo tee /etc/fail2ban/filter.d/nginx-login-200.conf > /dev/null <<EOF
[Definition]
failregex = ^<HOST>.*"\${METHOD}.*\${PAGE}.*\${PROTOCOL}/1\.[01]".* \${HTTP_CODE} [0-9]+
ignoreregex =
EOF

sudo tee /etc/fail2ban/jail.d/nginx-login-200.local > /dev/null <<__EOF__
[nginx-login-200]
enabled  = true
filter   = nginx-login-200
logpath  = /var/log/nginx/access.log
backend  = auto

# Soglie
findtime = \${FINDTIME}
maxretry = \${MAXRETRY}
bantime  = \${BANTIME}

# Azione
action   = %(action_mwl)s
__EOF__

sudo  service fail2ban restart

#------fluetbit
if ! command -v fluent-bit >/dev/null 2>&1; then
    # Fallback installation
    sudo apt update
    sudo apt install -y curl gpg
    curl -fsSL https://packages.fluentbit.io/fluentbit.key | \
      sudo gpg --dearmor -o /usr/share/keyrings/fluentbit-keyring.gpg
    echo 'deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/debian/bookworm bookworm main' | \
      sudo tee /etc/apt/sources.list.d/fluent-bit.list
    sudo apt update
    sudo apt install -y fluent-bit
    sudo ln -s /opt/fluent-bit/bin/fluent-bit /usr/local/bin/fluent-bit
    sudo mkdir -p /var/lib/fluent-bit
    sudo chown $(whoami):$(whoami) /var/lib/fluent-bit
    systemctl enable --now fluent-bit
fi

TEXT_FILE="/var/log/fail2ban.log"
LOKI_IP="10.1.0.254"
sudo tee /etc/fluent-bit/sender.conf > /dev/null <<'EOF'
[SERVICE]
    Flush         1
    Daemon        Off
    Log_Level     info
    storage.path  /var/lib/fluent-bit/storage
    Parsers_File  /etc/fluent-bit/parsers_fail2ban.conf

# ========= INPUT =========
[INPUT]
    Name              tail
    Path              /var/log/fail2ban.log
    Tag               fail2ban.log
    DB                /var/lib/fluent-bit/fail2ban.db
    Mem_Buf_Limit     5MB
    Skip_Long_Lines   On
    storage.type      filesystem
    Refresh_Interval  1
    Read_From_Head    Off
    Parser            fail2ban_ban

# ========= FILTER =========
[FILTER]
    Name   grep
    Match  fail2ban.log
    Regex  action  Ban

# ricostruisce la riga pulita
[FILTER]
    Name   modify
    Match  fail2ban.log
    Set    log Ban \${ip}

# ========= OUTPUT =========
[OUTPUT]
    Name          loki
    Match         fail2ban.log
    Host          10.1.0.254
    Port          3100
    Labels        job=fail2ban,env=lab,host=f2b,ip=\${ip}
    Line_Format   json
EOF

fluent-bit -c /etc/fluent-bit/sender.conf
`;
			}
		}
		// Signatures (array)
		if (machine.type === "ngfw" && machine.ngfw && Array.isArray(machine.ngfw.signatures)) {
			for (const sig of machine.ngfw.signatures) {
				console.log("[DEBUG] Generating Signature for", machine.name);
				const input_addr = sig.input_addr || "10.0.0.1";
				const output_addr = sig.output_addr || "10.0.1.1";
				const new_int = sig.new_int || "eth1";
				const signature_name = sig.signature_name || "modbus-invalidreg";
				const signature_body = sig.signature_body || "alert tcp $HOME_NET 502 -> $EXTERNAL_NET any (msg: \\\"Traffic detected\\\"; sid:1000001; rev:1; byte_test:1,=,0x02,8;)";
				const findtime = sig.findtime || "10m";
				const maxretry = sig.maxretry || "5";
				const bantime = sig.bantime || "1h";

				lab.file[machine.name + ".startup"] += `
snortadd ${input_addr} ${output_addr} ${new_int} ${signature_name} '${signature_body}' ${findtime} ${maxretry} ${bantime}
`;
			}
		}
	}
}


/*---------------------------------------------*/
/*------------- NAMESERVER CONFIG -------------*/
/*---------------------------------------------*/

function makeNameserver(netkit, lab) {
	//Gestione Nameserver
	//variabili d'appoggio comuni ai vari cicli
	let authority = [];
	let nsroot;

	// generazione file e cartelle comuni
	for (let machine of netkit) {
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
		if (machine.name && machine.name != "" && machine.type == "ns") {
			lab.file[machine.name + ".startup"] += "systemctl start named\n";
			lab.folders.push(machine.name + "/etc/bind");
			lab.file[machine.name + "/etc/bind/named.conf"] = "include \"/etc/bind/named.conf.options\";\n";
			lab.file[machine.name + "/etc/bind/named.conf.options"] = "options {\ndirectory \"/var/cache/bind\";\n";
			if (machine.ns.recursion) {
				lab.file[machine.name + "/etc/bind/named.conf.options"] += "allow-recursion {0/0;};\n";
			}
			lab.file[machine.name + "/etc/bind/named.conf.options"] += "dnssec-validation no;\n};";
		}
		//Trovo il root-ns e lo salvo
		if (machine.name && machine.name != "" && machine.type == "ns" && machine.ns.authority && machine.ns.zone == ".") {
			nsroot = machine;
		}
	}

	//Se non ho root-ns evito di generare una configurazione incoerente
	//db.root in ogni macchina dns
	if (nsroot) {
		for (let machine of netkit) {
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
			if (machine.name && machine.name != "" && machine.type == "ns") {
				lab.file[machine.name + "/etc/bind/db.root"] = "";
				if (machine.ns.authority && machine.ns.zone == ".") {
					lab.file[machine.name + "/etc/bind/db.root"] += "$TTL   60000\n@    IN SOA " + nsroot.interfaces.if[0].name +
						" root." + nsroot.interfaces.if[0].name + " 2006031201 28800 14400 3600000 0\n\n";
				}
				lab.file[machine.name + "/etc/bind/db.root"] += ".    IN NS " + nsroot.interfaces.if[0].name + "\n";
				lab.file[machine.name + "/etc/bind/db.root"] += nsroot.interfaces.if[0].name + "    IN A " + nsroot.interfaces.if[0].ip.split("/")[0] + "\n";
				if (machine.ns.authority && machine.ns.zone == ".") {
					lab.file[machine.name + "/etc/bind/named.conf"] += "zone \".\" {\n type master;\n file \"/etc/bind/db.root\";\n};\n\n";
				} else {
					lab.file[machine.name + "/etc/bind/named.conf"] += "zone \".\" {\n type hint;\n file \"/etc/bind/db.root\";\n};\n\n";
				}
			}

		}
		//entry in db.zona e named.conf per le altre macchine
		for (let machine of netkit) {
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
			if (machine.name && machine.name != "" && machine.type == "ns" && machine.ns.authority) {
				authority[machine.ns.zone] = machine;
				if (machine.ns.zone != ".") {
					lab.file[machine.name + "/etc/bind/db" + machine.ns.zone.slice(0, -1)] = "$TTL   60000\n@    IN SOA " + machine.interfaces.if[0].name + " root." + machine.interfaces.if[0].name + " 2006031201 28800 14400 3600000 0\n\n"; //ho preso il nome dell'interfaccia eth0
					lab.file[machine.name + "/etc/bind/named.conf"] += "zone \"" + machine.ns.zone.slice(1, -1) + "\" {\n type master;\n file \"/etc/bind/db" + machine.ns.zone.slice(0, -1) + "\";\n};\n\n";
				}
			}
		}
		//entry per l'alberatura delle zone (. conosce .com, .com conosce pippo.com, ecc)
		for (let machine of netkit) {
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
			if (machine.name && machine.name != "") {
				for (let f in machine.interfaces.if) {
					let ip;
					if (machine.interfaces.if[f].ip)
						ip = machine.interfaces.if[f].ip.split("/")[0];
					if (machine.interfaces.if[f].name) { //Entrano tutte le interfacce di tutte le macchine con un nome ns
						//Caso particolare per ns di primo livello
						if (machine.ns.zone && machine.type == "ns" && machine.ns.authority && machine.ns.zone.split(".").length == 3) {
							lab.file[authority["."].name + "/etc/bind/db.root"] +=
								machine.ns.zone.substring(1) + "    IN NS "
								+ machine.interfaces.if[f].name + "\n" + machine.interfaces.if[f].name
								+ "    IN A " + ip + "\n";
							lab.file[machine.name + "/etc/bind/db" + machine.ns.zone.slice(0, -1)] +=
								machine.ns.zone.substring(1) + "    IN NS "
								+ machine.interfaces.if[f].name + "\n" + machine.interfaces.if[f].name
								+ "     IN A " + machine.interfaces.if[f].ip.split("/")[0] + "\n";
						} else {
							let nome = machine.interfaces.if[f].name; //www.pluto.net.
							let nomediviso = nome.split("."); //[0]www [1]pluto [2]net [3].
							let a = ".";

							//Questo for toglie il primo pezzo www.pluto.net. => pluto.net.
							for (let i = 1; i < nomediviso.length; i++) {
								if (nomediviso[i] != "") {
									a += nomediviso[i] + ".";
								}
							}

							if (authority[a] && authority[a].ns.zone) {
								let fileExt = authority[a].ns.zone.slice(0, -1);
								//Evito che entri in caso di root-ns
								if (fileExt != "") {
									//se è un NS inserisco il glue record
									if (machine.type == "ns" && machine.ns.authority) {
										//Creo le linee relative a me stesso nel mio file db
										let aSup = ".";
										let nomediviso2 = authority[a].ns.zone.split(".");
										//Questo for toglie il primo pezzo .www.pluto.net. => pluto.net.
										for (let i = 2; i < nomediviso2.length; i++) {
											if (nomediviso2[i] != "") {
												aSup += nomediviso2[i] + ".";
											}
										}
										lab.file[authority[aSup].name + "/etc/bind/db" + authority[aSup].ns.zone.slice(0, -1)] +=
											machine.ns.zone.substring(1) + "    IN NS " + machine.interfaces.if[f].name + "\n"
											+ machine.interfaces.if[f].name + "    IN A " + machine.interfaces.if[f].ip.split("/")[0] + "\n"

									}
									//e poi inserisco anche il record A, altrimenti solo A
									if (machine.type == "ns" && machine.ns.authority) {
										lab.file[authority[a].name + "/etc/bind/db" + fileExt] += machine.ns.zone.substring(1) + "    IN NS " + machine.interfaces.if[f].name + "\n";
									}
									lab.file[authority[a].name + "/etc/bind/db" + fileExt] += machine.interfaces.if[f].name + "    IN A " + ip + "\n";
								}
							}
						}

					}
				}
			}
		}
	}
}


function makeOVSwitch(netkit, lab) {
	for (let machine of netkit) {
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
		if (machine.name && machine.name != "" && machine.type == "switch") {
			lab.file["lab.conf"] += machine.name + '[image]="kathara/sdn"\n';
			lab.file[machine.name + ".startup"] +=
				machine.interfaces.if.map(function (el) {
					if (el.eth.number != 0) return "ifconfig eth" + el.eth.number + " 0";
				}).join("\n") + "\n" +

				"\nservice openvswitch-switch start\n" +
				"ovs-vsctl add-br br0\n" +

				machine.interfaces.if.map(function (el) {
					if (el.eth.number != 0) return "ovs-vsctl add-port br0 eth" + el.eth.number;
				}).join("\n") + "\n" +

				"\novs-vsctl set bridge br0 protocols=[OpenFlow13]\n" +
				"ovs-vsctl set-controller br0 tcp:192.168.100.1:6633\n";
		}
	}
}

function makeRyuController(netkit, lab) {
	let isSDN = false;
	for (let machine of netkit) {
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
		if (machine.name && machine.name != "" && machine.type == "controller") {
			lab.file["lab.conf"] += machine.name + '[image]="kathara/sdn"\n';
			isSDN = true;

			let filename = machine.name + ".startup";
			let ryuAppPrefix = "ryu.app.";

			// Avvio le app Ryu
			lab.file[filename] += "\nryu-manager ";
			if (machine.ryu.topology)
				lab.file[filename] += "--observe-links " + ryuAppPrefix + "rest_topology ";
			if (machine.ryu.stp)
				lab.file[filename] += ryuAppPrefix + "simple_switch_stp_13 ";
			if (machine.ryu.rest)
				lab.file[filename] += ryuAppPrefix + "ofctl_rest ";
			if (machine.ryu.custom) {
				let apps = machine.ryu.custom.split(" ");
				for (let app of apps) {
					lab.file[filename] += ryuAppPrefix + app + " ";
				}
			}

			if (!(machine.ryu.topology || machine.ryu.stp || machine.ryu.custom || machine.ryu.rest)) {
				lab.file[filename] += ryuAppPrefix + "simple_switch_13";
			}
		}
	}

	// if (isElectron() && isSDN) document.getElementById("connect").classList.remove("hidden");
	// else document.getElementById("connect").classList.add("hidden");
}


function makeFilesStructure(netkit, labInfo) {
	let isAllValidNames = netkit
		.map(machine => machine.name && /[A-z0-9]+/i.test(machine.name))
		.reduce((prev, curr, ind) => ind == 0 ? curr : (prev && curr))	// Tutti i nomi devono aver soddisfatto la regex
	if (!isAllValidNames)
		return { folders: [], file: [] }

	// Enforce attacker name globally
	netkit.forEach(m => {
		if (m.type === "attacker") m.name = "attacker";
	});

	var lab = {};
	lab.folders = [];
	lab.file = [];
	lab.warning = 0;
	lab.error = 0;
	makeLabInfo(labInfo, lab);
	makeMachineFolders(netkit, lab);
	makeLabConfFile(netkit, lab);
	makeStartupFiles(netkit, lab);
	makeStaticRouting(netkit, lab);
	makeTerminal(netkit, lab);
	makeAttacker(netkit, lab);
	makeRouter(netkit, lab);
	makeWebserver(netkit, lab);
	makeNameserver(netkit, lab);
	makeIndustrialDevices(netkit, lab);
	makeNGFW(netkit, lab);
	makeOther(netkit, lab);
	makeOVSwitch(netkit, lab);
	makeRyuController(netkit, lab);

	if (labInfo.toggle == "disable")
		makeGraph(netkit);

	return lab;
}

function makeScript(lab) {
	let text = "#! /bin/sh\n"
		+ "# Remember to use 'chmod +x' (o 'chmod 500') on the .sh file. The script will self-destruct\n"
		+ "\n"
		+ "rm -rf \"$(dirname \"$0\")/lab\"\n"
		+ "mkdir \"$(dirname \"$0\")/lab\"\n"
		+ "cd \"$(dirname \"$0\")/lab\"\n";

	for (let folderName of lab.folders) {
		if (folderName != "") text += "mkdir -p " + folderName + "\n";
	}

	for (let fileName in lab.file) {
		text += "\ntouch " + fileName + "\n";
		let lines = lab.file[fileName].split("\n");
		for (let line of lines) {
			if (line != "") text += "echo '" + line + "' >> " + fileName + "\n";
		}
	}

	text += "\nrm \"../$0\"\n";
	return text;
}

function makeZip(lab) {
	let zip = new JSZip();

	for (let folderName of lab.folders) {
		zip.folder(folderName);
	}
	for (let fileName in lab.file) {
		zip.file(fileName, lab.file[fileName]);
	}
	let content = zip.generateAsync({ type: "blob" }).then(function (content) {
		saveAs(content, "lab.zip");
	})
}

export const makeDownload = (text, filename) => {
	var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
	saveAs(blob, filename);
};

export const generateScript = (netkitData, labInfoData) => {
	return makeScript(makeFilesStructure(netkitData, labInfoData));
};

export const generateConfig = (netkitData, labInfoData) => {
	var all = [{ labInfo: labInfoData, netkit: netkitData }];
	return JSON.stringify(all, undefined, 4);
};

export const generateZip = (netkitData, labInfoData) => {
	return makeZip(makeFilesStructure(netkitData, labInfoData));
};
