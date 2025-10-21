FROM debian:trixie

RUN apt update && \
    apt install -y iproute2 python3 python3-pymodbus

COPY ./random_modbus.py /random_modbus.py 
