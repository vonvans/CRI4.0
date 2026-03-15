# Dockerfile — Kali-based container with Scapy port scanner inside
FROM kalilinux/kali-rolling@sha256:eb500810d9d44236e975291205bfd45e9e19b7f63859e3a72ba30ea548ddb1df

LABEL maintainer="you@example.com"
WORKDIR /root

# copia gli script nello stesso path (metti questi file nel context della build)
# - script.sh (se lo usi)
# - port_scan_scapy.py (lo script Scapy didattico)

COPY port_scan_scapy.py /usr/local/bin/port_scan_scapy.py

# installa dipendenze necessarie per Scapy e strumenti di rete
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      python3-dev \
      build-essential \
      libpcap-dev \
      tcpdump \
      iproute2 \
      net-tools \
      ca-certificates \
      sudo \
      iputils-ping \
      gcc && \
    pip3 install --no-cache-dir --break-system-packages scapy smoloki requests && \
    # rendi eseguibili gli script e crea link utili (usa nomi coerenti)

    chmod +x /usr/local/bin/port_scan_scapy.py || true && \
    ln -sf /usr/local/bin/port_scan_scapy.py /usr/local/bin/port-scapy || true && \
    # pulizia per ridurre spazio immagine
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Imposta PATH e working dir
ENV PATH="/usr/local/bin:${PATH}"
WORKDIR /root

# Default: mantieni bash come entrypoint per uso interattivo.
# Esegui lo script passando argomenti: `docker run ... port-scapy 172.18.0.0/24 --output /tmp/out.json`
ENTRYPOINT ["bash"]