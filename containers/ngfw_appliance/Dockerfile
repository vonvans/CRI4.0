FROM debian:13-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt update && apt install -y iproute2

# TCP proxy
RUN apt update && apt install -y nginx-full fail2ban && \ 
    sed -i '\|/etc/nginx/sites-enabled|d' /etc/nginx/nginx.conf && \
    printf "stream {\n}\n" >>/etc/nginx/nginx.conf

# install suricata
ENV PATH="/root/.local/bin:/usr/local/bin:${PATH}"
RUN apt update && apt install -y jq iproute2 ipcalc wget sed curl suricata tar git kmod fail2ban nftables && \
    mkdir -p /etc/nftables.d/ && \
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    /root/.local/bin/uv tool install git+https://github.com/CoLorenzo/tolist && \
    wget $(curl -s https://api.github.com/repos/asdf-vm/asdf/releases/latest | jq -r '.assets[] | select(.name | test("^asdf-.*linux-amd64.tar.gz$")) | .browser_download_url') -O asdf.tar.gz && \
    tar -xf ./asdf.tar.gz -C /usr/local/bin/ && \
    rm ./asdf.tar.gz && \   
    asdf plugin add yq https://github.com/sudermanjr/asdf-yq.git && \
    asdf install yq latest && \
    asdf set -u yq latest && \
    export PATH="$HOME/.asdf/shims:$PATH" && \
    echo 'export PATH="$HOME/.asdf/shims:$PATH"' >>~/.bashrc && \
    yq -i '.threshold-file = "/etc/suricata/threshold.config"' /etc/suricata/suricata.yaml && \
    yq eval '.af-packet[0]."tpacket-v3" = "yes"' -i /etc/suricata/suricata.yaml && \
    yq eval 'del(.outputs | select(tag == "!!seq") | select(length == 3))' -i /etc/suricata/suricata.yaml && \
    yq -i 'del(.vars."address-groups".HOME_NET)' /etc/suricata/suricata.yaml && \
    sed -i 's/RUN=no/RUN=yes/' /etc/default/suricata

COPY f2bcompanion /usr/local/bin/f2bcompanion
COPY f2bcompanion.service /etc/init.d/f2bcompanion
COPY loki.conf /etc/fail2ban/action.d/loki.conf
COPY modbus-invalidreg.rules /var/lib/suricata/rules/modbus-invalidreg.rules
COPY suricata-1000001.conf /etc/fail2ban/filter.d/suricata-1000001.conf

#TODO: move above
RUN apt update && apt install -y procps
RUN chmod +x /usr/local/bin/f2bcompanion
RUN chmod +x /etc/init.d/f2bcompanion
RUN touch /tmp/f2b.log
RUN touch /var/log/f2bcompanion.err

COPY snortadd /usr/local/bin/snortadd
RUN chmod +x /usr/local/bin/snortadd

RUN apt install -y crudini
RUN rm /etc/init.d/suricata
COPY suricata.service /etc/init.d/suricata
RUN chmod +x /etc/init.d/suricata

# Install smoloki
RUN uv tool install smoloki --with requests
RUN printf '#!/bin/sh\nexec uv run smoloki "$@"\n' >/usr/local/bin/smoloki && chmod +x /usr/local/bin/smoloki

COPY wafadd /usr/local/bin/wafadd
RUN chmod +x /usr/local/bin/wafadd

COPY loki.conf /etc/fail2ban/action.d/loki.conf