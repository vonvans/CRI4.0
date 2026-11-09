FROM frangoteam/fuxa:latest

RUN apt update && apt install -y iproute2 jq

# Install smoloki
RUN apt update && apt install -y curl ca-certificates
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"
RUN uv venv /opt/venv
ENV VIRTUAL_ENV="/opt/venv"
ENV PATH="/opt/venv/bin:${PATH}"
RUN uv pip install requests smoloki
RUN printf '#!/bin/sh\nexec uv run smoloki "$@"\n' >/usr/local/bin/smoloki && chmod +x /usr/local/bin/smoloki

COPY fuxa_device_add /usr/local/bin/fuxa_device_add
RUN chmod +x /usr/local/bin/fuxa_device_add

#TODO: move above
RUN apt update && apt install -y uuid-runtime
COPY fuxa_tag_add /usr/local/bin/fuxa_tag_add
RUN chmod +x /usr/local/bin/fuxa_tag_add

ENTRYPOINT ["bash"]
