import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  RadioGroup,
  Radio,
  Select,
  SelectItem,
} from "@nextui-org/react";

function LogInsightsPage() {
  const [logs, setLogs] = useState([]);
  const [hostnameSearch, setHostnameSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [generalSearch, setGeneralSearch] = useState("");
  const [timeRange, setTimeRange] = useState("last_30_minutes");
  const [customTime, setCustomTime] = useState({ start: "", end: "" });
  const [isLive, setIsLive] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  // Escapes special characters for regex in LogQL
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escDQ = (s) => s.replace(/"/g, '\\"');

  // Builds Loki's WebSocket Tail URL based on filters
  const buildLokiTailUrl = () => {
    // Base selector with at least one non-empty matcher (required by Loki 3.x)
    // Use a label you know exists (e.g., job, host, env, service_name)
    const matchers = ['job=~".+"'];

    if (hostnameSearch.trim()) {
      matchers.push(`host=~"${escRe(hostnameSearch.trim())}"`);
    }

    if (severityFilter) {
      // Radio: "info" | "warning" | "error"
      matchers.push(`level="${severityFilter.toLowerCase()}"`);
    }

    const selector = `{${matchers.join(",")}}`;

    // Content filters (pipeline)
    let pipeline = "";
    if (logSearch.trim()) {
      pipeline += ` |~ "${escDQ(logSearch.trim())}"`;
    }
    if (generalSearch.trim()) {
      pipeline += ` |~ "${escDQ(generalSearch.trim())}"`;
    }

    const logqlQuery = `${selector}${pipeline}`;
    const url = `ws://localhost:3100/loki/api/v1/tail?query=${encodeURIComponent(
      logqlQuery
    )}&limit=200`;
    return url;
  };

  // Opens the WS connection to Loki Tail
  const openWebSocket = () => {
    try {
      if (ws.current) {
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onerror = null;
        ws.current.onclose = null;
        try {
          ws.current.close();
        } catch {}
      }

      const url = buildLokiTailUrl();
      const socket = new WebSocket(url);

      socket.onopen = () => {
        setIsLive(true);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.streams) {
            setLogs((prev) => {
              const incoming = data.streams.flatMap((stream) =>
                stream.values.map(([ts, line]) => {
                  const ns = Number(ts); // ns epoch
                  const ms = Math.floor(ns / 1e6);
                  const level = (stream.stream.level || "info").toLowerCase();
                  return {
                    id: `${ts}-${Math.random()}`,
                    timestamp: new Date(ms),
                    message: line,
                    hostname: stream.stream.host || "N/A",
                    severity:
                      level === "warn"
                        ? "WARNING"
                        : (level || "info").toUpperCase(), // INFO/WARNING/ERROR
                  };
                })
              );
              // Add new logs to the top and limit to 500
              return [...incoming.reverse(), ...prev].slice(0, 500);
            });
          }
        } catch (e) {
          // Ignore non-JSON frames
        }
      };

      const scheduleReconnect = () => {
        setIsLive(false);
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(() => {
          openWebSocket();
        }, 1200); // Simple backoff
      };

      socket.onerror = () => scheduleReconnect();
      socket.onclose = () => scheduleReconnect();

      ws.current = socket;
    } catch (e) {
      setIsLive(false);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => {
        openWebSocket();
      }, 1500);
    }
  };

  // Connect/reconnect when filters change
  useEffect(() => {
    openWebSocket();
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (ws.current) {
        try {
          ws.current.close();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostnameSearch, logSearch, severityFilter, generalSearch]);

  const handleSearch = () => {
    setLogs([]);
    // Changing filters will trigger the useEffect -> WS reconnection
  };

  const handleClearFilters = () => {
    setHostnameSearch("");
    setLogSearch("");
    setSeverityFilter("");
    setGeneralSearch("");
    setTimeRange("last_30_minutes");
    setCustomTime({ start: "", end: "" });
    setLogs([]);
  };

  // Compute start/end in *nanoseconds* for Loki delete API
  const getStartEndNs = () => {
    const nowMs = Date.now();
    let startMs = nowMs - 30 * 60 * 1000; // default 30 minutes
    let endMs = nowMs;

    if (timeRange === "last_minute") {
      startMs = nowMs - 60 * 1000;
    } else if (timeRange === "last_5_minutes") {
      startMs = nowMs - 5 * 60 * 1000;
    } else if (timeRange === "last_30_minutes") {
      startMs = nowMs - 30 * 60 * 1000;
    } else if (timeRange === "custom" && customTime.start && customTime.end) {
      const s = new Date(customTime.start).getTime();
      const e = new Date(customTime.end).getTime();
      if (!Number.isNaN(s)) startMs = s;
      if (!Number.isNaN(e)) endMs = e;
    }

    // Convert to nanoseconds (string to avoid precision issues in very large numbers)
    const toNs = (ms) => `${BigInt(Math.floor(ms)) * 1000000n}`;
    return { startNs: toNs(startMs), endNs: toNs(endMs) };
  };

  // Very broad selector for deletion (must not be empty). Adjust label to one that always exists in your tenant.
  const broadDeleteSelector = '{job=~".+"}';

  const handleCleanLogs = async () => {
    setIsCleaning(true);
    try {
      const { startNs, endNs } = getStartEndNs();

      const payload = {
        query: broadDeleteSelector,
        start: startNs,
        end: endNs,
      };

      // 1) Try custom API route (Next.js/Express). Avoids CORS.
      let res = await fetch("/api/loki-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // 2) Fallback: if 404 (route not present), try a proxy-mounted direct path
      // e.g., Vite devServer proxy mapping "/loki" -> "http://localhost:3100"
      if (res.status === 404) {
        const params = new URLSearchParams({
          query: payload.query,
          start: payload.start,
          end: payload.end,
        });
        res = await fetch(`/loki/api/v1/delete?${params.toString()}`, {
          method: "POST",
        });
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Loki delete failed (${res.status}): ${text}`);
      }

      setLogs([]);
      openWebSocket();
    } catch (err) {
      console.error(err);
      alert(`Error while submitting delete: ${err.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  const currentLogs = logs;

  const severityColors = {
    INFO: "bg-green-500",
    WARNING: "bg-orange-500",
    ERROR: "bg-red-500",
  };

  return (
    <div className="min-h-screen p-4 bg-gray-900 text-white">
      <div className="flex justify-end items-center mb-6">
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            isLive ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {isLive ? "Live Stream" : "Offline"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <Card className="bg-gray-800">
          <CardHeader>
            <h2 className="text-lg font-semibold">Hostname Search</h2>
          </CardHeader>
          <CardBody>
            <Input
              type="text"
              placeholder="Enter hostname..."
              value={hostnameSearch}
              onChange={(e) => setHostnameSearch(e.target.value)}
              className="w-full"
            />
          </CardBody>
        </Card>

        <Card className="bg-gray-800">
          <CardHeader>
            <h2 className="text-lg font-semibold">Log Search</h2>
          </CardHeader>
          <CardBody>
            <Input
              type="text"
              placeholder="Enter keywords..."
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              className="w-full"
            />
          </CardBody>
        </Card>

        <Card className="bg-gray-800">
          <CardHeader>
            <h2 className="text-lg font-semibold">Severity Filter</h2>
          </CardHeader>
          <CardBody>
            <RadioGroup
              value={severityFilter}
              onValueChange={setSeverityFilter}
              orientation="horizontal"
            >
              <Radio value="info">INFO</Radio>
              <Radio value="warning">WARNING</Radio>
              <Radio value="error">ERROR</Radio>
            </RadioGroup>
          </CardBody>
        </Card>

        <Card className="bg-gray-800">
          <CardHeader>
            <h2 className="text-lg font-semibold">Time Range</h2>
          </CardHeader>
          <CardBody>
            <Select
              placeholder="Select range"
              selectedKeys={[timeRange]}
              onSelectionChange={(keys) => {
                const selectedKey = Array.from(keys)[0];
                setTimeRange(selectedKey);
              }}
            >
              <SelectItem key="last_minute" value="last_minute">
                Last minute
              </SelectItem>
              <SelectItem key="last_5_minutes" value="last_5_minutes">
                Last 5 minutes
              </SelectItem>
              <SelectItem key="last_30_minutes" value="last_30_minutes">
                Last 30 minutes
              </SelectItem>
              <SelectItem key="custom" value="custom">
                From X to Y
              </SelectItem>
            </Select>
            {timeRange === "custom" && (
              <div className="flex flex-col gap-2 mt-2">
                <Input
                  type="datetime-local"
                  label="Start date & time"
                  value={customTime.start}
                  onChange={(e) =>
                    setCustomTime({ ...customTime, start: e.target.value })
                  }
                />
                <Input
                  type="datetime-local"
                  label="End date & time"
                  value={customTime.end}
                  onChange={(e) =>
                    setCustomTime({ ...customTime, end: e.target.value })
                  }
                />
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="bg-gray-800">
          <CardHeader>
            <h2 className="text-lg font-semibold">General Search</h2>
          </CardHeader>
          <CardBody>
            <Input
              type="text"
              placeholder="Search all logs..."
              value={generalSearch}
              onChange={(e) => setGeneralSearch(e.target.value)}
              className="w-full"
            />
          </CardBody>
        </Card>
      </div>

      <div className="flex justify-end gap-2 mb-4">
        <Button color="primary" onClick={handleSearch}>
          Search
        </Button>
        <Button color="danger" onClick={handleClearFilters}>
          Clear Filters
        </Button>
        <Button color="warning" isLoading={isCleaning} onClick={handleCleanLogs}>
          {isCleaning ? "Cleaning..." : "Clean logs"}
        </Button>
      </div>

      <div className="overflow-x-auto bg-gray-800 rounded-lg p-4">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Hostname
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Message
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {currentLogs.length > 0 ? (
              currentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-2 00">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {log.hostname}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        severityColors[log.severity] || "bg-gray-600"
                      }`}
                    >
                      {log.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 max-w-sm truncate">
                    {log.message}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="4"
                  className="px-6 py-4 text-center text-sm text-gray-400"
                >
                  Waiting for logs...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LogInsightsPage;
