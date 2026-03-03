FROM debian:trixie

RUN apt-get update && apt-get install -y \
	python3 python3-pip git iproute2 net-tools procps \
	&& rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages \
	scapy netaddr netifaces pycryptodome requests psutil inquirer tabulate

WORKDIR /app

RUN git clone https://github.com/Cyphysecurity/NEFICS.git .

RUN sed -i "s/ipaddresses *= *ifaddresses(list(gtwys\['default'\].values())\[0\]\[1\])/ipaddresses = ifaddresses('eth0')/" /app/nefics/modules/devicebase.py

COPY launcher_cri.py /app/launcher_cri.py

RUN chmod +x /app/launcher_cri.py

ENV PYTHONPATH=/app
ENTRYPOINT ["/bin/sh", "-c", "sleep infinity"]

