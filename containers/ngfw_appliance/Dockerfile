FROM debian:13-slim

# Set noninteractive for apt
ENV DEBIAN_FRONTEND=noninteractive

# Update and install base deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    jq iproute2 ipcalc wget sed curl suricata tar git pipx gpg sendmail\
    && rm -rf /var/lib/apt/lists/*


# Install docker-systemctl-replacement
RUN pipx install docker-systemctl-replacement \
    && ln -s /root/.local/bin/systemctl.py /usr/local/bin/systemctl

# Install asdf
RUN LATEST=$(curl -s https://api.github.com/repos/asdf-vm/asdf/releases/latest \
      | jq -r '.assets[] | select(.name | test("^asdf-.*linux-amd64.tar.gz$")) | .browser_download_url') \
    && wget $LATEST -O asdf.tar.gz \
    && tar -xf ./asdf.tar.gz -C /usr/local/bin/ \
    && rm ./asdf.tar.gz

ENV PATH="/root/.asdf/shims:${PATH}"

# Install yq via asdf
RUN asdf plugin add yq https://github.com/sudermanjr/asdf-yq.git \
    && asdf install yq 4.47.2 \
    && echo "yq 4.47.2" >> /root/.tool-versions \
    && ln -s /root/.asdf/shims/yq /sbin/yq

# Install tolist command
RUN curl -sfL https://raw.githubusercontent.com/LB2A/Monorepo/refs/heads/main/tolist_installer.sh | bash -
# Configure Suricata (robusto anche se non ci sono ancora regole)
RUN mkdir -p /etc/suricata/rules /var/lib/suricata/rules /var/lib/suricata/update \
    && yq -i '.threshold-file = "/etc/suricata/threshold.config"' /etc/suricata/suricata.yaml \
    && suricata-update update-sources || true \
    && suricata-update || true \
    && groupadd -f suricata \
    && chgrp -R suricata /etc/suricata /var/lib/suricata || true \
    && chmod -R g+r /etc/suricata \
    && chmod -R g+rw /var/lib/suricata/rules /var/lib/suricata/update \
    && usermod -a -G suricata root \
    && if compgen -G "/var/lib/suricata/rules/*.rules" > /dev/null; then \
         ln -sf /var/lib/suricata/rules/*.rules /etc/suricata/rules/ ; \
       fi \
    && yq -i 'del(.vars."address-groups".HOME_NET)' /etc/suricata/suricata.yaml


# Install Zeek
RUN DEBIAN_VERSION_ID=$(grep VERSION_ID /etc/os-release | sed 's/VERSION_ID=//' | tr -d '"') \
    && curl -fsSL https://download.opensuse.org/repositories/security:/zeek/Debian_${DEBIAN_VERSION_ID}/Release.key \
        | gpg --dearmor > /etc/apt/trusted.gpg.d/zeek.gpg \
    && echo "deb http://download.opensuse.org/repositories/security:/zeek/Debian_${DEBIAN_VERSION_ID}/ ./" \
        > /etc/apt/sources.list.d/zeek.list \
    && apt-get update && apt-get install -y --no-install-recommends zeek \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/zeek/bin:${PATH}"

RUN echo 'redef Log::default_logdir = "/opt/zeek/logs/";' \
    >> /opt/zeek/share/zeek/site/local.zeek

RUN touch /opt/zeek/logs/notice.log

# Install Fluent Bit
RUN curl -fsSL https://packages.fluentbit.io/fluentbit.key | \
        gpg --dearmor -o /usr/share/keyrings/fluentbit-keyring.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/debian/bookworm bookworm main' \
        > /etc/apt/sources.list.d/fluent-bit.list \
    && apt-get update && apt-get install -y --no-install-recommends fluent-bit \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /opt/fluent-bit/bin/fluent-bit /usr/local/bin/fluent-bit \
    && mkdir -p /var/lib/fluent-bit \
    && chown root:root /var/lib/fluent-bit

# Enable Fluent Bit via systemctl replacement
RUN systemctl enable --now fluent-bit || true

COPY ./suricata.conf /etc/fluent-bit/suricata.conf 
COPY ./zeek.conf  /etc/fluent-bit/zeek.conf
