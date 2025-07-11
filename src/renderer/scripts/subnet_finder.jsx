/* eslint-disable prefer-const */
/* eslint-disable prefer-template */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-plusplus */
/* eslint-disable no-restricted-properties */
/* eslint-disable prefer-exponentiation-operator */
/* eslint-disable radix */
/* eslint-disable no-bitwise */
/* eslint-disable prettier/prettier */
function ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
}

function numberToIp(num) {
    return [num >> 24 & 255, num >> 16 & 255, num >> 8 & 255, num & 255].join('.');
}

function subnetHosts(cidr) {
    return Math.pow(2, 32 - cidr) - 2;
}

function findSmallestCidr(hosts) {
    for (let cidr = 32; cidr >= 0; cidr--) {
        if (subnetHosts(cidr) >= hosts) {
            return cidr;
        }
    }
    return null;
}

export function findAvailableSubnet(usedSubnets, requiredHosts) {
    const privateRanges = [
        { start: "10.0.0.0", end: "10.255.255.255", cidr: 8 },
        { start: "172.16.0.0", end: "172.31.255.255", cidr: 12 },
        { start: "192.168.0.0", end: "192.168.255.255", cidr: 16 }
    ];

    const usedSubnetsRanges = usedSubnets.map(subnet => {
        const [ip, cidr] = subnet.split('/');
        const startIp = ipToNumber(ip);
        const endIp = startIp + subnetHosts(parseInt(cidr));;
        return { startIp, endIp };
    });

    function isRangeAvailable(startIp, endIp) {
        return !usedSubnetsRanges.some(subnet => {
            return (startIp <= subnet.endIp && endIp >= subnet.startIp);
        });
    }

    const requiredCidr = findSmallestCidr(requiredHosts);
    if (requiredCidr === null) {
        return null;
    }

    for (const range of privateRanges) {
        const start = ipToNumber(range.start);
        const end = ipToNumber(range.end);

        for (let currentIp = start; currentIp <= end; currentIp += subnetHosts(requiredCidr) + 2) {
            const subnetEndIp = currentIp + subnetHosts(requiredCidr);
            if (subnetEndIp > end) break;

            if (isRangeAvailable(currentIp, subnetEndIp)) {
                return numberToIp(currentIp) + "/" + requiredCidr;
            }
        }
    }

    return null;
}

export function getUsableIPs(subnet) {
    const [ip, cidr] = subnet.split('/');
    const startIp = ipToNumber(ip);
    const numHosts = subnetHosts(parseInt(cidr));

    const firstUsableIp = startIp + 1;
    const lastUsableIp = startIp + numHosts;

    let usableIps = [];
    for (let i = firstUsableIp; i <= lastUsableIp; i++) {
        usableIps.push(numberToIp(i));
    }

    return usableIps;
}
