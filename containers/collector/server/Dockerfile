# BUILD STAGE
FROM golang:1.23.2-bookworm as builder

RUN apt update && apt install -y bash iproute2

WORKDIR /app

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o collector /app/main.go

RUN rm -rf /tmp/* /var/log/*

# RUN STAGE
FROM scratch

WORKDIR /app

COPY --from=builder /app/collector .
COPY --from=builder /bin/bash /bin/bash
COPY --from=builder /lib/x86_64-linux-gnu/libtinfo.so.6 /lib/x86_64-linux-gnu/libtinfo.so.6
COPY --from=builder /lib/x86_64-linux-gnu/libdl.so.2 /lib/x86_64-linux-gnu/libdl.so.2
COPY --from=builder /lib/x86_64-linux-gnu/libc.so.6 /lib/x86_64-linux-gnu/libc.so.6
COPY --from=builder /lib64/ld-linux-x86-64.so.2 /lib64/ld-linux-x86-64.so.2

# iproute2 binaries and dependencies
COPY --from=builder /sbin/ip /sbin/ip
COPY --from=builder /lib/x86_64-linux-gnu/libbpf.so.1 /lib/x86_64-linux-gnu/libbpf.so.1
COPY --from=builder /lib/x86_64-linux-gnu/libmnl.so.0 /lib/x86_64-linux-gnu/libmnl.so.0
COPY --from=builder /lib/x86_64-linux-gnu/libelf.so.1 /lib/x86_64-linux-gnu/libelf.so.1
COPY --from=builder /lib/x86_64-linux-gnu/libbsd.so.0 /lib/x86_64-linux-gnu/libbsd.so.0
COPY --from=builder /lib/x86_64-linux-gnu/libcap.so.2 /lib/x86_64-linux-gnu/libcap.so.2
COPY --from=builder /lib/x86_64-linux-gnu/libz.so.1 /lib/x86_64-linux-gnu/libz.so.1
COPY --from=builder /lib/x86_64-linux-gnu/libmd.so.0 /lib/x86_64-linux-gnu/libmd.so.0

# cat binary and dependencies
COPY --from=builder /bin/cat /bin/cat

# umount binary and depencencies
COPY --from=builder /bin/umount /bin/umount
COPY --from=builder /lib/x86_64-linux-gnu/libmount.so.1 /lib/x86_64-linux-gnu/libmount.so.1
COPY --from=builder /lib/x86_64-linux-gnu/libblkid.so.1 /lib/x86_64-linux-gnu/libblkid.so.1
COPY --from=builder /lib/x86_64-linux-gnu/libselinux.so.1 /lib/x86_64-linux-gnu/libselinux.so.1
COPY --from=builder /lib/x86_64-linux-gnu/libpcre2-8.so.0 /lib/x86_64-linux-gnu/libpcre2-8.so.0

# tar binary and dependencies
COPY --from=builder /bin/tar /bin/tar
COPY --from=builder /lib/x86_64-linux-gnu/libacl.so.1 /lib/x86_64-linux-gnu/libacl.so.1

# chmod binary and dependencies
COPY --from=builder /bin/chmod /bin/chmod

# chown binary and dependencies
COPY --from=builder /bin/chown /bin/chown

# sed binary and dependencies
COPY --from=builder /bin/sed /bin/sed

# touch binary and dependencies
COPY --from=builder /bin/touch /bin/touch

COPY --from=builder /tmp /tmp
COPY --from=builder /var/log /var/log

EXPOSE 1337

ENTRYPOINT ["/bin/bash"]