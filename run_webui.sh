#!/usr/bin/env bash
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"


cd ${SCRIPT_DIR}

npm run web:dev
