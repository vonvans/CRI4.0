FROM debian:trixie

RUN apt-get update && apt-get install -y iproute2

# Install smoloki
RUN apt-get update && apt-get install -y curl ca-certificates
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"
RUN uv venv /opt/venv
ENV VIRTUAL_ENV="/opt/venv"
ENV PATH="/opt/venv/bin:${PATH}"
RUN uv pip install requests smoloki
RUN printf '#!/bin/sh\nexec uv run smoloki "$@"\n' >/usr/local/bin/smoloki && chmod +x /usr/local/bin/smoloki

COPY requirements.txt /requirements.txt
RUN uv pip install -r requirements.txt
COPY fan.py /fan.py
RUN chmod +x /fan.py

# Copy and set up the startup wrapper script
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
