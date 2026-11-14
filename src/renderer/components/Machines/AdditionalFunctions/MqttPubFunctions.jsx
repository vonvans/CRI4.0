/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { Input } from "@nextui-org/input";

// Configuration for an MQTT publisher machine: it runs `mosquitto_pub` in a
// timed loop against a broker. These values are baked into the machine's
// startup script (see the "mqtt_pub" branch in make-node.jsx). Defaults mirror
// the example the user provided.
const DEFAULTS = {
    broker_addr: "10.0.0.1",
    broker_port: "1883",
    topic: "test/topic",
    message: '{"value": 100}',
    time: "1",
    username: "",
    password: "",
};

export function MqttPubFunctions({ machine, machines, setMachines }) {
    const cfg = { ...DEFAULTS, ...(machine.mqtt || {}) };

    const patch = (key, value) => {
        setMachines(machines.map((m) => (m.id === machine.id
            ? { ...m, mqtt: { ...DEFAULTS, ...(m.mqtt || {}), [key]: value } }
            : m)));
    };

    return (
        <div className="flex flex-col gap-3 pt-1">
            <p className="text-xs text-default-500">
                Publishes <span className="font-mono">MESSAGE</span> to{" "}
                <span className="font-mono">TOPIC</span> every{" "}
                <span className="font-mono">TIME</span> seconds via
                <span className="font-mono"> mosquitto_pub</span>.
            </p>

            <div className="grid grid-cols-2 gap-2">
                <Input
                    size="sm"
                    label="Broker address"
                    placeholder={DEFAULTS.broker_addr}
                    value={cfg.broker_addr}
                    onValueChange={(v) => patch("broker_addr", v)}
                />
                <Input
                    size="sm"
                    type="number"
                    label="Broker port"
                    placeholder={DEFAULTS.broker_port}
                    value={cfg.broker_port}
                    onValueChange={(v) => patch("broker_port", v)}
                />
            </div>

            <Input
                size="sm"
                label="Topic"
                placeholder={DEFAULTS.topic}
                value={cfg.topic}
                onValueChange={(v) => patch("topic", v)}
            />

            <Input
                size="sm"
                label="Message"
                placeholder={DEFAULTS.message}
                value={cfg.message}
                onValueChange={(v) => patch("message", v)}
            />

            <Input
                size="sm"
                type="number"
                label="Interval (seconds)"
                placeholder={DEFAULTS.time}
                value={cfg.time}
                onValueChange={(v) => patch("time", v)}
                min={0}
                step="0.1"
            />

            <p className="text-xs text-default-500 mt-1">
                Optional broker login (leave empty if the broker allows anonymous).
            </p>
            <div className="grid grid-cols-2 gap-2">
                <Input
                    size="sm"
                    label="Username"
                    value={cfg.username}
                    onValueChange={(v) => patch("username", v)}
                />
                <Input
                    size="sm"
                    type="password"
                    label="Password"
                    value={cfg.password}
                    onValueChange={(v) => patch("password", v)}
                />
            </div>
        </div>
    );
}
