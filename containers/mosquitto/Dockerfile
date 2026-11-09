FROM icr/cribase

RUN apt-get update \
 && apt-get install -y mosquitto mosquitto-clients netcat-openbsd \
 && rm -rf /var/lib/apt/lists/*
