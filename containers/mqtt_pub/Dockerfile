FROM icr/cribase

RUN apt-get update \
 && apt-get install -y mosquitto mosquitto-clients netcat-openbsd \
 && rm -rf /var/lib/apt/lists/*

# mkcert root CA so mosquitto_pub can speak TLS to the TLS termination proxy.
COPY containers/tls_termination_proxy/rootCA.pem /rootCA.pem
