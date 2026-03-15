#!/bin/bash

# Get endpoint from environment variable, default to localhost
ENDPOINT="${ENDPOINT:-http://localhost:8000/}"

# Run the temperature sensor with the endpoint
# Build the command arguments
ARGS="-e $ENDPOINT"

if [ "${SINE_WAVE:-false}" = "true" ]; then
    ARGS="$ARGS --sine"
    if [ -n "$SINE_PERIOD" ]; then
        ARGS="$ARGS --period $SINE_PERIOD"
    fi
    if [ -n "$SINE_AMPLITUDE" ]; then
        ARGS="$ARGS --amplitude $SINE_AMPLITUDE"
    fi
    if [ -n "$SINE_OFFSET" ]; then
        ARGS="$ARGS --offset $SINE_OFFSET"
    fi
fi

# Run the temperature sensor with the constructed arguments
exec uv run /tsens.py $ARGS
