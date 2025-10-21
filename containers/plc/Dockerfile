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
    ./install.sh linux

#install OpenPLC-CLI
RUN apt update && \
    apt install -y pipx && \
    pipx install git+https://github.com/CoLorenzo/openplc-cli.git

#install iproute2
RUN apt update && apt install -y iproute2
