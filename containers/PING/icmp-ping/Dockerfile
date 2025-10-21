# Dockerfile — Kali-based container with git clone di un repo lecito
FROM kalilinux/kali-rolling@sha256:eb500810d9d44236e975291205bfd45e9e19b7f63859e3a72ba30ea548ddb1df

LABEL maintainer="you@example.com"
WORKDIR /root


# Installa dipendenze minime (git e utility)
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      git \
      ca-certificates \
      iproute2 \
      net-tools \
      sudo \
      iputils-ping && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      python3-dev \
      python3-pyqt5 \
      build-essential \
      libpcap-dev \
      tcpdump \
      iproute2 \
      net-tools \
      ca-certificates \
      sudo \
      iputils-ping \
      gcc  \
	hping3
    



# Mantieni bash come entrypoint
ENTRYPOINT ["bash"]