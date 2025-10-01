FROM kathara/base:latest

# Install Loki
RUN wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor > /etc/apt/keyrings/grafana.gpg && \
    chmod 644 /etc/apt/keyrings/grafana.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | tee /etc/apt/sources.list.d/grafana.list && \
    apt update && apt install -y loki

# Workaround: not sure why this line causes an error, so I remove it
# TODO: Investigate why 'enable_multi_variant_queries' causes issues in /etc/loki/config.yml
RUN sed -i '/^[[:space:]]*enable_multi_variant_queries:/d' /etc/loki/config.yml