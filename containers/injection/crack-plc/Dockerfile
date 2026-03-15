FROM kalilinux/kali-rolling

# Update and install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gpg \
    git \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Clone OpenPLC Crack
WORKDIR /opt
RUN git clone https://github.com/CoLorenzo/openplc-crack && \
    cd openplc-crack \
    git checkout loki

# Copy configuration files
COPY entrypoint.sh /usr/local/bin/
COPY fluent-bit.conf /root/

RUN chmod +x /usr/local/bin/entrypoint.sh && \
    chmod +x /opt/openplc-crack/run.sh

#TODO: move above
RUN apt update && apt install -y iproute2

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


WORKDIR /opt/openplc-crack
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

