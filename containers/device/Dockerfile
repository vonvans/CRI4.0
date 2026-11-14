FROM golang:latest AS builder

RUN go install github.com/magefile/mage@latest

WORKDIR /src
COPY containers/device /src
RUN mage build

FROM icr/cribase

COPY --from=builder /src/bin/physics-sim /usr/local/bin/physics-sim
COPY --from=builder /src/bin/temp-sensor /usr/local/bin/temp-sensor
COPY --from=builder /src/bin/valve-actuator /usr/local/bin/valve-actuator
COPY --from=builder /src/bin/mock-plc /usr/local/bin/mock-plc

COPY containers/device/configs /scenario-defaults
COPY containers/device/start.sh /start.sh
RUN chmod +x /start.sh
