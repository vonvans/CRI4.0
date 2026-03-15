#!/bin/bash
if [ "$#" -lt 1 ]; then
echo "Usage: $0 <target_ip1> <target_ip2> ... <target_ipN>"
exit 1
fi

for TARGET_IP in "$@"; do
echo "Ping flood on $TARGET_IP complete."
done
