#!/bin/sh
# Device machine launcher.
#
# Two roles, selected with the DEVICE_MODE env var (set in lab.conf by the
# generated lab):
#   physical-sim  → runs the physics simulation + gateway + web UI, using the
#                   main scenario configs (simulation/gateway/visualization).
#   peripheral    → runs a single peripheral binary (e.g. temp-sensor) from the
#                   device config shipped to /scenario, connecting to the
#                   physics simulator over netstream (NETSTREAM_ADDR).
#
# The scenario directory defaults to /scenario. User-provided configs are
# copied there by the Kathara startup script; if the directory is missing
# or lacks the main configs, the defaults baked into the image are used.

SCENARIO_DIR="${SCENARIO_DIR:-/scenario}"
DEFAULTS_DIR="/scenario-defaults"
MODE="${DEVICE_MODE:-physical-sim}"

mkdir -p "$SCENARIO_DIR"

if [ "$MODE" = "peripheral" ]; then
    # Launch the (single) peripheral device config shipped to /scenario.
    for DEVICE_FILE in "$SCENARIO_DIR"/*.json; do
        BASENAME=$(basename "$DEVICE_FILE")
        case "$BASENAME" in
            simulation.json|gateway.json|visualization.json) continue ;;
        esac

        DEVICE_TYPE=$(jq -r '.device_type' "$DEVICE_FILE")

        case "$DEVICE_TYPE" in
            TempSensor)     BIN="temp-sensor" ;;
            ValveActuator)  BIN="valve-actuator" ;;
            *)
                echo "[device] SKIP $BASENAME: no driver for '$DEVICE_TYPE'"
                continue
                ;;
        esac

        # Point the peripheral at the (possibly remote) physics simulator. The
        # shipped config keeps its pristine value; we rewrite it at runtime.
        if [ -n "$NETSTREAM_ADDR" ]; then
            jq --arg a "$NETSTREAM_ADDR" '.netstream_addr = $a' "$DEVICE_FILE" > /tmp/device.json \
                && mv /tmp/device.json "$DEVICE_FILE"
        fi

        echo "[device] launching $BIN --config $DEVICE_FILE"
        "$BIN" --config "$DEVICE_FILE" &
    done

    wait
    exit 0
fi

# ── physical-sim mode (default) ────────────────────────────────────────────

# Fall back to the default scenario if the user did not provide one
for MAIN in simulation.json gateway.json visualization.json; do
    if [ ! -f "$SCENARIO_DIR/$MAIN" ]; then
        cp "$DEFAULTS_DIR/$MAIN" "$SCENARIO_DIR/$MAIN"
    fi
done

echo "[device] starting physics-sim"
physics-sim \
    --sim-cfg "$SCENARIO_DIR/simulation.json" \
    --net-cfg "$SCENARIO_DIR/gateway.json" \
    --vis-cfg "$SCENARIO_DIR/visualization.json" &

wait
