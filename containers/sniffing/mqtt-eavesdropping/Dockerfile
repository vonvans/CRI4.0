FROM debian:bookworm

# Runtime deps: mosquitto_sub (mosquitto-clients), ip (iproute2), pkill (procps),
# plus Fluent Bit installed from the official Fluent Bit apt repository.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    curl gpg ca-certificates mosquitto-clients iproute2 procps jq \
 && curl -fsSL https://packages.fluentbit.io/fluentbit.key \
    | gpg --dearmor -o /usr/share/keyrings/fluentbit-keyring.gpg \
 && echo 'deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/debian/bookworm bookworm main' \
    > /etc/apt/sources.list.d/fluent-bit.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends fluent-bit \
 && ln -sf /opt/fluent-bit/bin/fluent-bit /usr/local/bin/fluent-bit \
 && mkdir -p /var/lib/fluent-bit /etc/fluent-bit \
 && rm -rf /var/lib/apt/lists/*

# smoloki, so the attacker's Kathara startup can emit its "ready" signal
# (same mechanism the other attack images use).
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"
RUN uv venv /opt/venv
ENV VIRTUAL_ENV="/opt/venv"
ENV PATH="/opt/venv/bin:${PATH}"
RUN uv pip install requests smoloki \
 && printf '#!/bin/sh\nexec uv run smoloki "$@"\n' > /usr/local/bin/smoloki \
 && chmod +x /usr/local/bin/smoloki

COPY containers/sniffing/mqtt-eavesdropping/mqtt-eavesdropping.sh /usr/local/bin/mqtt-eavesdropping.sh
RUN chmod +x /usr/local/bin/mqtt-eavesdropping.sh

# mkcert root CA so mosquitto_sub can eavesdrop through the TLS termination proxy.
COPY containers/tls_termination_proxy/rootCA.pem /rootCA.pem
