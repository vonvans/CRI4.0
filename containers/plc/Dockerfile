FROM debian:trixie

# Install docker-systemctl-replacement
ENV PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin
RUN apt update && \
    apt install -y pipx && \
    pipx install docker-systemctl-replacement && \
    pipx ensurepath && \
    ln -s /root/.local/bin/systemctl.py /usr/local/bin/systemctl

#install OpenPLCv3
RUN apt update && \
    apt install -y git sudo && \
    git clone https://github.com/thiagoralves/OpenPLC_v3.git /opt/OpenPLC_v3 && \
    cd /opt/OpenPLC_v3 && \
    git checkout f0d627a7f810865d58e8c4ce3ca01ef160286e85 && \
    ./install.sh linux

RUN apt update && apt install -y iproute2

#Install openplc-cli
RUN echo "caching" #TODO:DELETE
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"
RUN uv tool install git+https://github.com/CoLorenzo/openplc-cli.git

#install supervisord
RUN apt update && apt install -y supervisor
COPY ./supervisord.conf /etc/supervisor/supervisord.conf

RUN openplc-cli settings set Start_run_mode true

#CMD ["/opt/OpenPLC_v3/start_openplc.sh", "/usr/local/bin/systemctl", "start", "openplc"]
