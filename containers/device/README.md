# Device (physics simulation)

Kathara machine that runs the CRI4.0 physics simulation
([cri40-scenario-tools](https://github.com/t3labit/cri40-scenario-tools),
vendored in this directory) together with the Modbus peripherals that
expose it on the network.

At startup (`start.sh`):

1. `physics-sim` is launched with `simulation.json`, `gateway.json` and
   `visualization.json` from the scenario directory (`/scenario`). It serves
   a web UI on port `8080` and the netstream pub/sub protocol on `8082`.
2. Every other `*.json` file in the scenario directory is treated as a
   peripheral config: its `device_type` selects the binary to launch
   (`TempSensor` → `temp-sensor`, `ValveActuator` → `valve-actuator`),
   each one exposing its variables via Modbus on the port set in
   `modbus_bind`.

The user uploads the scenario files from the CRI4.0 UI (machine type
"Device"); they are shipped to the lab via `/shared/<machine>/` and copied
to `/scenario` by the machine's startup script. If nothing is uploaded, the
default scenario in `configs/` is used.

## Updating the vendored sources

```bash
cp -R /opt/cri40-scenario-tools/{cmd,internal,configs,go.mod,go.sum,Magefile.go} .
```
