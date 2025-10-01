FROM kathara/base:latest

USER root

WORKDIR /root

# Install fluentbit
RUN apt update && apt install -y curl gpg && \
    curl -fsSL https://packages.fluentbit.io/fluentbit.key | \
    gpg --dearmor -o /usr/share/keyrings/fluentbit-keyring.gpg && \
    echo 'deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/debian/bookworm bookworm main' | \
  tee /etc/apt/sources.list.d/fluent-bit.list
RUN apt update && apt install -y fluent-bit
RUN ln -s /opt/fluent-bit/bin/fluent-bit /usr/local/bin/fluent-bit
RUN mkdir -p /var/lib/fluent-bit
RUN chown root:root /var/lib/fluent-bit
RUN systemctl enable --now fluent-bit