#! /bin/bash

if [ "$#" -ne 4 ]; then
    echo "Usage: $0 <seconds> <interface> <destination_ip1> <destination_ip2>"
    exit 1
fi

time=$1
interface=$2
destination_ip1=$3
destination_ip2=$4

timeout ${time}s tshark -i $interface \
  -Y "ip.dst == $destination_ip1 || ip.dst == $destination_ip2" \
  -P -x > /tmp/sniffing.pcap

export SMOLOKI_BASE_ENDPOINT="http://10.1.0.254:3100"
smoloki '{"job":"sniffing","level":"info"}' '{"message":"$(cat /tmp/sniffing.pcap)"}'