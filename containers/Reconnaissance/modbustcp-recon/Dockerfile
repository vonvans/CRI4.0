FROM debian:trixie
WORKDIR /root
ENTRYPOINT ["bash"]

RUN apt update && apt install -y git tcpdump iproute2 jq

# Install python2.7
RUN apt update && apt-get install -y build-essential wget tar curl build-essential libreadline-dev libssl-dev zlib1g-dev libbz2-dev libsqlite3-dev libffi-dev && \
    wget "https://www.python.org/ftp/python/2.7.18/Python-2.7.18.tgz" && \
    tar -xzf Python-2.7.18.tgz &&  \
    rm Python-2.7.18.tgz && \
    cd Python-2.7.18 && \
    ./configure --enable-unicode=ucs4 && \
    make -j$(nproc) && \
    make altinstall && \
    cd .. && \
    rm -drf Python-2.7.18 && \
    curl https://bootstrap.pypa.io/pip/2.7/get-pip.py -o get-pip.py && \
    python2.7 get-pip.py && \
    rm get-pip.py

# Install modTester
RUN git clone https://github.com/sfl0r3nz05/ModTester.git && \
    mv ModTester /opt/ && \
    echo "alias modtester='python2.7 /opt/ModTester/modTester.py'" >>~/.bashrc

# Install smoloki
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"
RUN uv venv /opt/venv
ENV VIRTUAL_ENV="/opt/venv"
ENV PATH="/opt/venv/bin:${PATH}"
RUN uv pip install requests smoloki
RUN printf '#!/bin/sh\nexec uv run smoloki "$@"\n' >/usr/local/bin/smoloki && \
    chmod +x /usr/local/bin/smoloki

COPY script.sh /usr/local/bin/script.sh
RUN chmod 777 /usr/local/bin/script.sh
