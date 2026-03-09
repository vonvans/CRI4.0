FROM debian:13-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt update && \
    apt install -y jq iproute2 ipcalc wget sed curl suricata tar git suricata-update kmod fail2ban nftables && \
    \
    YQ_VERSION=v4.44.3 && \
    wget https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64 -O /usr/local/bin/yq && \
    chmod +x /usr/local/bin/yq && \
    \
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    export PATH="/root/.local/bin:$PATH" && \
    uv tool install git+https://github.com/CoLorenzo/tolist && \
    \
    yq -i '.threshold-file = "/etc/suricata/threshold.config"' /etc/suricata/suricata.yaml && \
    yq eval '.af-packet[0]."tpacket-v3" = true' -i /etc/suricata/suricata.yaml && \
    yq eval 'del(.outputs | select(tag == "!!seq") | select(length == 3))' -i /etc/suricata/suricata.yaml && \
    suricata-update && \
    yq -i 'del(.vars."address-groups".HOME_NET)' /etc/suricata/suricata.yaml && \
    sed -i 's/RUN=no/RUN=yes/' /etc/default/suricata && \
    \
    mkdir -p /etc/nftables.d; \
    nft add table inet filter || true; \
    nft add chain inet filter input '{ type filter hook input priority 0 ; }' || true; \
    nft add rule inet filter input tcp dport 502 queue num 0 || true; \
    systemctl enable fail2ban || true; \
    modprobe nfnetlink_queue || true

# WAP
RUN apt update && apt install -y nginx-full fail2ban
RUN sed -i '\|/etc/nginx/sites-enabled|d' /etc/nginx/nginx.conf
RUN printf "stream {\n}\n" >> /etc/nginx/nginx.conf

# Install smoloki
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"
RUN uv venv /opt/venv
ENV VIRTUAL_ENV="/opt/venv"
ENV PATH="/opt/venv/bin:${PATH}"
RUN uv pip install requests smoloki
RUN printf '#!/bin/sh\nexec uv run smoloki "$@"\n' > /usr/local/bin/smoloki \
 && chmod +x /usr/local/bin/smoloki