/* eslint-disable prettier/prettier */
export const labInfoModel = {
  description: "",
  version: "",
  author: "",
  email: "",
  web: "",
};

export const backboneModel = {
  name: "",
  row: 1,
  type: "terminal",
  attackLoaded: false,
  attackImage: "",
  attackCommand: "",
  targets: [],
  routingSoftware: "frr",
  interfaces: {
    counter: 1,
    if: [
      {
        eth: {
          number: 0,
          domain: "",
        },
        ip: "",
        name: "",
      },
    ],
    free: "",
  },
  gateways: {
    counter: 1,
    gw: [
      {
        gw: "",
        route: "",
        if: 0,
      },
    ],
  },
  pc: {
    dns: "-",
  },
  ws: {
    userdir: false,
  },
  ns: {
    name: "",
    recursion: true,
    authority: true,
  },
  other: {
    image: "",
    files: [],
    fileCounter: 0,
  },
  ryu: {
    stp: false,
    rest: true,
    topology: true,
    custom: "",
  },
  routing: {
    rip: {
      en: false,
      connected: false,
      ospf: false,
      bgp: false,
      network: [""],
      route: [""],
      free: "",
    },
    ospf: {
      en: false,
      connected: false,
      rip: false,
      bgp: false,
      if: [{
          cost: 0,
          interface: null
      }],
      network: [""],
      area: [""],
      stub: [false],
      free: "",
    },
    bgp: {
      en: false,
      as: "",
      network: [""],
      remote: [
        {
          neighbor: "",
          as: "",
          description: "",
        },
      ],
      free: "",
    },
    frr: {
      free: "",
    },
  }
};

export const attacksModel = [
  {
    name: "arp-scanning",
    displayName: "ARP Scanning",
    category: "Reconnaissance",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "icmp-scanning",
    displayName: "ICMP Scanning",
    category: "Reconnaissance",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "port-scanning",
    displayName: "Port Scanning",
    category: "Reconnaissance",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "os-fingerprinting",
    displayName: "OS Fingerprinting",
    category: "Reconnaissance",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "service-enumeration",
    displayName: "Service Enumeration",
    category: "Reconnaissance",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "arp-spoofing",
    displayName: "ARP Spoofing",
    category: "mitm",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "dns-spoofing",
    displayName: "DNS Spoofing",
    category: "mitm",
    attackLoaded: false,
    image: "",
    isImage: false,
  },

  {
    name: "icmp-flood",
    displayName: "ICMP Flood",
    category: "dos",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "syn-flood",
    displayName: "SYN Flood",
    category: "dos",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "udp-flood",
    displayName: "UDP Flood",
    category: "dos",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "modbus-writecoil",
    displayName: "Modbus Write Coil",
    category: "injection",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "modbus-writeregister",
    displayName: "Modbus Write Register",
    category: "injection",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
   {
    name: "packet-sniffing",
    displayName: "Packet Sniffing",
    category: "sniffing",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "modbus-read",
    displayName: "Modbus Read",
    category: "sniffing",
    attackLoaded: false,
    image: "",
    isImage: false,
  },
  {
    name: "modbustcp-flood",
    displayName: "Modbus-TCP flood",
    category: "dos",
    attackLoaded: false,
    image: "",
    isImage: false,
  }
]
