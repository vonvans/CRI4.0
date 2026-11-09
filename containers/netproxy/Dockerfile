FROM golang:latest AS builder

RUN go install github.com/magefile/mage@latest

WORKDIR /src
COPY containers/netproxy /src
RUN mage build

FROM icr/cribase

COPY --from=builder /src/bin/netproxy /netproxy
RUN install /netproxy /bin
