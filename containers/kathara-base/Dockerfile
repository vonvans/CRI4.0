FROM debian:trixie

RUN apt update && apt install -y iproute2

# set root password
USER root
WORKDIR /root
RUN echo "root:cri40" | chpasswd


# install docker-systemctl-replacement
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    pipx \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.local/bin:${PATH}"
RUN pipx install docker-systemctl-replacement
RUN ln -sf /root/.local/bin/systemctl.py /usr/local/bin/systemctl


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

# Install openssh
RUN apt update && apt install -y openssh-server ssh
RUN sed -i \
  -e '/^[#[:space:]]*PermitRootLogin[[:space:]]\+/d' \
  -e '/^[#[:space:]]*PasswordAuthentication[[:space:]]\+/d' \
  -e '$a PermitRootLogin yes\nPasswordAuthentication yes' \
  /etc/ssh/sshd_config

COPY start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

CMD ["/usr/local/bin/start.sh"]
