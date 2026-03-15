FROM kathara/base:latest

# Install Loki
RUN wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor > /etc/apt/keyrings/grafana.gpg && \
    chmod 644 /etc/apt/keyrings/grafana.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" > /etc/apt/sources.list.d/grafana.list && \
    apt-get update && apt-get install -y --no-install-recommends loki && \
    rm -rf /var/lib/apt/lists/*

# (ok) rimuovi l’opzione problematica dal config di default
# Copy custom configuration
COPY loki-config.yml /etc/loki/config.yml

# Check configuration (optional but good for debugging build)
RUN cat /etc/loki/config.yml

# Assicurati che Loki ascolti su tutte le interfacce
# (se il file già lo fa, questa riga non serve; in alternativa puoi passarlo come flag)
# RUN sed -i 's/^ *http_listen_address:.*$/  http_listen_address: 0.0.0.0/' /etc/loki/config.yml

EXPOSE 3100

# Avvio in foreground: niente systemd/supervisord
CMD ["/usr/bin/loki", \
     "-config.file=/etc/loki/config.yml", \
     "-server.http-listen-address=0.0.0.0", \
     "-server.http-listen-port=3100"]