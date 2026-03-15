FROM kalilinux/kali-rolling@sha256:eb500810d9d44236e975291205bfd45e9e19b7f63859e3a72ba30ea548ddb1df

RUN echo "nameserver 8.8.8.8" > /etc/resolv.conf
RUN apt update && apt install -y tshark

# Install smoloki
COPY sniffing.sh /usr/local/bin/sniffing.sh
RUN chmod +x /usr/local/bin/sniffing.sh
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
