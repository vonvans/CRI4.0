FROM debian:trixie

ENV DEBIAN_FRONTEND=noninteractive

# Update and install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    sudo \
    git \
    jq \
    curl \
    ca-certificates \
    ettercap-text-only \
    nftables \
    vim \
    procps \
    && rm -rf /var/lib/apt/lists/*

#Install UV
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"
RUN uv venv

# Setup Modbus Server
WORKDIR /opt
RUN git clone https://github.com/cybcon/modbus-server
WORKDIR /opt/modbus-server
RUN uv venv && \
    . .venv/bin/activate && \
    uv pip install -r ./src/requirements.txt

# Create wrapper script
RUN echo '#!/usr/bin/env bash' > /usr/local/bin/modbus-server && \
    echo 'cd /opt/modbus-server || exit 1' >> /usr/local/bin/modbus-server && \
    echo 'source .venv/bin/activate' >> /usr/local/bin/modbus-server && \
    echo 'exec uv run ./src/app/modbus_server.py "$@"' >> /usr/local/bin/modbus-server && \
    chmod +x /usr/local/bin/modbus-server

# Config handling
COPY server_config.json /server_config.json
RUN REG_ID="1" && \
    VALUE="50" && \
    tmp=$(mktemp) && \
    jq --arg id "$REG_ID" --argjson val "$VALUE" \
    '.registers.inputRegister[$id] = $val' /server_config.json > "$tmp" \
    && mv "$tmp" /server_config.json && \
    chmod 644 /server_config.json

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

RUN apt update && apt install -y iproute2

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]