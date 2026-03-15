#!/bin/bash

# Get endpoint from environment variable, default to localhost
ENDPOINT="${ENDPOINT:-http://localhost:8000/}"

# Run the fan with the endpoint
exec uv run /fan.py -e "$ENDPOINT"
