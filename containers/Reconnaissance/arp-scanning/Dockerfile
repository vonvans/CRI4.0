# Dockerfile — Kali-based container with arp-scan script inside
FROM kalilinux/kali-rolling@sha256:eb500810d9d44236e975291205bfd45e9e19b7f63859e3a72ba30ea548ddb1df

# metadata
LABEL maintainer="you@example.com"
WORKDIR /root

# copia lo script (assicurati che script.sh sia nel context della build)
COPY arp_scan.sh /usr/local/bin/arp_scan.sh

# installa dipendenze, rende eseguibile lo script e pulisce la cache apt
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      arp-scan \
      iproute2 \
      net-tools \
      ca-certificates \
      sudo \
      iputils-ping && \
    chmod +x /usr/local/bin/arp_scan.sh && \
    # opzionale: crea link comodo
    ln -s /usr/local/bin/arp_scan.sh /usr/local/bin/arp-scan-script || true && \
    # pulizia per ridurre spazio immagine
    apt-get clean && rm -rf /var/lib/apt/lists/*

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


# Mantieni bash come entrypoint (puoi cambiarlo se vuoi eseguire lo script di default)
ENTRYPOINT ["bash"]