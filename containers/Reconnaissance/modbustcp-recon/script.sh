#!/bin/bash
if [ "$#" -lt 1 ]; then
echo "Usage: $0 <target_ip1> <target_ip2> ... <target_ipN>"
exit 1
fi

for TARGET_IP in "$@"; do
echo "Scanning target: $TARGET_IP"
REG_TYPES=("discreteInput" "inputRegister" "holdingRegister" "coil")
echo "Scanning for ${REG_TYPES[@]} on $TARGET_IP"
DEV_PORT="502"
DEV_UID="1"
LOG_FILE="./scan_result_${TARGET_IP}.txt"

for REG_TYPE in ${REG_TYPES[@]}; do
echo "Scanning for ${REG_TYPE} on $TARGET_IP"
python2.7 /opt/ModTester/modTester.py << __EOF__ > /tmp/raw_modtester.txt 2>&1
use modbus/scanner/${REG_TYPE}Discover
set RHOSTS ${TARGET_IP}
set RPORT ${DEV_PORT}
set UID ${DEV_UID}
exploit
exit
exit
__EOF__
cat /tmp/raw_modtester.txt | sed -n '/-\{10,\}/,/SMOD/p' | grep -v "SMOD" | sed 's/ en memoria//' >> ${LOG_FILE}
rm -f /tmp/raw_modtester.txt
done


OUTPUT="$(cat scan_result_${TARGET_IP}.txt)"
PAYLOAD=$(jq -n --arg msg "$OUTPUT" '{"message": $msg}')
smoloki -b "http://10.1.0.254:3100" '{"job":"test","level":"info", "host":"$HOSTNAME"}' "$PAYLOAD"

done
