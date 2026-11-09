#!/bin/bash

# Write environment variables to files
if [ -n "$USERNAMES" ]; then
    echo "$USERNAMES" > /opt/openplc-crack/usernames.txt
fi

if [ -n "$PASSWORDS" ]; then
    echo "$PASSWORDS" > /opt/openplc-crack/passwords.txt
fi

if [ -z "$TARGET" ]; then
    echo "Warning: TARGET environment variable is not set. Starting in idle mode."
    
    # Execute Kathara startup script if it exists to configure networking
    for f in /*.startup; do
        if [ -f "$f" ]; then
            echo "Executing startup script: $f"
            chmod +x "$f"
            "$f"
        fi
    done
    tail -f /dev/null
    exit 0
fi

# Change directory to ensure run.sh finds local files (fixes grep: login.html error)
cd /opt/openplc-crack
git checkout loki

# Run the attack
# Output to stderr (for docker logs) AND filter for SUCCESS to results.log (for Fluent Bit)
# We use stdbuf to avoid buffering delays if available, otherwise just standard pipe

echo "Starting OpenPLC/Crack on target: $TARGET"
./run.sh "http://$TARGET:8080" "http://10.1.0.254:3100"

# Keep container running after attack to allow log collection
tail -f /dev/null
