#!/bin/bash

# Get endpoint from environment variable, default to localhost
ENDPOINT="${ENDPOINT:-http://localhost:8000/}"

smoloki -b http://10.1.0.254:3100 '{"job":"test","level":"info", "host": "'"$(hostname)"'"}' '{"message":"ready"}'
# Run the fan with the endpoint
exec uv run /fan.py -e "$ENDPOINT"
