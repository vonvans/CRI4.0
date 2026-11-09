FROM debian:trixie


RUN apt-get update && apt-get install -y curl iproute2 jq

#Install uv
RUN apt-get update \
 && apt-get install --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && curl -LsSf https://astral.sh/uv/install.sh | sh 
ENV PATH="/root/.local/bin:${PATH}"

#Install smoloki
RUN uv tool install smoloki --with requests \
&& printf '#!/bin/sh\nexec uvx smoloki "$@"\n' > /usr/local/bin/smoloki \
&& chmod +x /usr/local/bin/smoloki
