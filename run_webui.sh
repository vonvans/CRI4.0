#!/usr/bin/env bash
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"

cd containers
docker compose build
cd ..

cd ${SCRIPT_DIR}

npm run web:dev
