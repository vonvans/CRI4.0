FROM debian:trixie
SHELL ["/bin/bash", "-lc"]
ENV DEBIAN_FRONTEND=noninteractive

RUN apt update && apt install -y iproute2 mkcert stunnel4
COPY ./rootCA-key.pem /rootCA-key.pem
COPY ./rootCA.pem /rootCA.pem
