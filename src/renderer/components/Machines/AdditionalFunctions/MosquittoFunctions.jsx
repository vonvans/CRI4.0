/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { useState } from "react";
import { Button } from "@nextui-org/react";
import { Input } from "@nextui-org/input";
import { MdDelete, MdAdd } from "react-icons/md";

// MQTT broker access control: an "allowed list" of username/password pairs.
// When non-empty, make-node builds a hashed password_file (mosquitto_passwd) and
// requires authentication on the network listeners. Stored in machine.mqtt.users.
export function MosquittoFunctions({ machine, machines, setMachines }) {
    const users = machine.mqtt?.users || [];

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const setUsers = (next) => {
        setMachines(machines.map((m) => (m.id === machine.id
            ? { ...m, mqtt: { ...(m.mqtt || {}), users: next } }
            : m)));
    };

    const canAdd =
        username.trim() !== "" &&
        password !== "" &&
        !users.some((u) => u.username === username.trim());

    const addUser = () => {
        if (!canAdd) return;
        setUsers([...users, { username: username.trim(), password }]);
        setUsername("");
        setPassword("");
    };

    const removeUser = (idx) => setUsers(users.filter((_, i) => i !== idx));

    return (
        <div className="flex flex-col gap-3 pt-1">
            <p className="text-xs text-default-500">
                Allowed users. Leave empty to keep the broker open (anonymous).
                When set, clients must authenticate with a username/password.
            </p>

            <div className="grid grid-cols-2 gap-2">
                <Input
                    size="sm"
                    label="Username"
                    value={username}
                    onValueChange={setUsername}
                />
                <Input
                    size="sm"
                    type="password"
                    label="Password"
                    value={password}
                    onValueChange={setPassword}
                />
            </div>
            <Button
                size="sm"
                color="primary"
                variant="flat"
                startContent={<MdAdd className="text-lg" />}
                isDisabled={!canAdd}
                onClick={addUser}
            >
                Add user
            </Button>

            {users.length > 0 && (
                <div className="flex flex-col gap-2">
                    {users.map((u, idx) => (
                        <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-default-50 rounded-lg border border-default-200"
                        >
                            <div className="flex items-center gap-2 text-xs">
                                <span className="font-mono font-semibold text-default-700">{u.username}</span>
                                <span className="text-default-400">:</span>
                                <span className="font-mono text-default-500">{"•".repeat(Math.min((u.password || "").length, 10)) || "—"}</span>
                            </div>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                aria-label="Remove user"
                                onClick={() => removeUser(idx)}
                            >
                                <MdDelete className="text-lg" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
