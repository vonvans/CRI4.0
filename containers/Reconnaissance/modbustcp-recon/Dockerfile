FROM debian:trixie
WORKDIR /root
COPY script.sh /root
ENTRYPOINT ["bash"]

RUN apt update && apt install -y git tcpdump

# Install python2.7
RUN apt update && apt-get install -y build-essential wget tar curl build-essential libreadline-dev libssl-dev zlib1g-dev libbz2-dev libsqlite3-dev libffi-dev && \
    wget "https://www.python.org/ftp/python/2.7.18/Python-2.7.18.tgz" && \
    tar -xzf Python-2.7.18.tgz && \
    rm Python-2.7.18.tgz && \
    cd Python-2.7.18 && \
    ./configure --enable-unicode=ucs4  && \
    make -j$(nproc)  && \
    make altinstall && \
    cd .. && \
    rm -drf Python-2.7.18 && \
    curl https://bootstrap.pypa.io/pip/2.7/get-pip.py -o get-pip.py && \
    python2.7 get-pip.py && \
    rm get-pip.py

# Install modTester
RUN git clone https://github.com/sfl0r3nz05/ModTester.git && \
mv ModTester /opt/ && \
echo "alias modtester='python2.7 /opt/ModTester/modTester.py'" >> ~/.bashrc

#TODO: move up
RUN apt install -y iproute2