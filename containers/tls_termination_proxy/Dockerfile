FROM debian:trixie
SHELL ["/bin/bash", "-lc"]
ENV DEBIAN_FRONTEND=noninteractive

RUN apt update && apt install -y iproute2 mkcert stunnel4 curl ca-certificates jq

# Use the committed mkcert root CA (baked at /rootCA*.pem) so the certs
# generated at container start are signed by a CA the clients (mqtt_pub,
# sniffing) also trust.
ENV CAROOT=/

# smoloki, so the proxy can emit its Kathara "ready" signal to Loki (same
# mechanism the other machine images use).
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"
RUN uv tool install smoloki --with requests \
 && printf '#!/bin/sh\nexec uvx smoloki "$@"\n' > /usr/local/bin/smoloki \
 && chmod +x /usr/local/bin/smoloki

COPY ./rootCA-key.pem /rootCA-key.pem
COPY ./rootCA.pem /rootCA.pem
