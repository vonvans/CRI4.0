# Dockerfile — Kali-based container with git clone di un repo lecito
FROM kalilinux/kali-rolling@sha256:eb500810d9d44236e975291205bfd45e9e19b7f63859e3a72ba30ea548ddb1df

LABEL maintainer="you@example.com"
WORKDIR /root



RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
	hping3
    



# Mantieni bash come entrypoint
ENTRYPOINT ["bash"]