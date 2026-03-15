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
  const [isFetching, setIsFetching] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  // Escapes special characters for regex in LogQL
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escDQ = (s) => s.replace(/"/g, '\\"');

  // Builds Loki's HTTP query URL based on filters
  const buildLokiQueryUrl = () => {
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

    const { start, end } = getStartEndSeconds();
    const startNs = start + "000000000";
    const endNs = end + "000000000";

    const params = new URLSearchParams({
      query: logqlQuery,
      limit: 200,
      direction: "BACKWARD",
      start: startNs,
      end: endNs
    });

    return `/api/loki-query?${params.toString()}`;
  };

  const fetchLogs = async () => {
    setIsFetching(true);
    try {
      const url = buildLokiQueryUrl();
      let res = await fetch(url);

      // Fallback: if 404 (route not present), try a proxy-mounted direct path
      if (res.status === 404) {
        const queryParams = url.split("?")[1];
        res = await fetch(`/loki/api/v1/query_range?${queryParams}`);
      }

      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();

      if (data.data && data.data.result) {
        const incoming = data.data.result.flatMap((stream) =>
          stream.values.map(([ts, line]) => {
            const ns = Number(ts); // ns epoch
            const ms = Math.floor(ns / 1e6);
            const level = (stream.stream.level || "info").toLowerCase();

            let message = line;
            try {
              const jsonLine = JSON.parse(line);
              if (jsonLine.log) {
                message = jsonLine.log;
              }
            } catch (e) {
              // Not a JSON string or doesn't have .log property
            }

            if (typeof message === "string" && message.startsWith("message=")) {
              message = message.slice(8);
            }

            return {
              id: `${ts}-${Math.random()}`,
              timestamp: new Date(ms),
              message: message,
              hostname: stream.stream.host || "N/A",
              severity:
                level === "warn"
                  ? "WARNING"
                  : (level || "info").toUpperCase(), // INFO/WARNING/ERROR
            };
          })
        );
        // Sort descending by timestamp
        incoming.sort((a, b) => b.timestamp - a.timestamp);
        // Limit to 500
        setLogs(incoming.slice(0, 500));
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error(e);
      setLogs([]);
    } finally {
      setIsFetching(false);
    }
  };

  // Fetch when filters change
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostnameSearch, logSearch, severityFilter, generalSearch]);

  const handleSearch = () => {
    fetchLogs();
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

  // Compute start/end in *seconds* for Loki delete API
  function getStartEndSeconds() {
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

    // Convert to seconds (string to avoid precision issues)
    const toSec = (ms) => String(Math.floor(ms / 1000));
    return { start: toSec(startMs), end: toSec(endMs) };
  };

  // Very broad selector for deletion (must not be empty). Adjust label to one that always exists in your tenant.
  const broadDeleteSelector = '{job=~".+"}';

  const handleCleanLogs = async () => {
    setIsCleaning(true);
    try {
      setLogs([]);
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
          className={`px-3 py-1 rounded-full text-sm font-semibold ${isFetching ? "bg-blue-500" : "bg-gray-600"
            }`}
        >
          {isFetching ? "Fetching Logs..." : "Idle"}
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
              aria-label="Hostname Search"
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
              aria-label="Log Search"
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
              aria-label="Severity Filter"
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
              aria-label="Time Range"
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
              aria-label="General Search"
            />
          </CardBody>
        </Card>
      </div>

      <div className="flex justify-end gap-2 mb-4">
        <Button color="primary" onClick={handleSearch}>
          Search
        </Button>
        <Button color="success" isLoading={isFetching} onClick={fetchLogs}>
          Refresh
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
                <React.Fragment key={log.id}>
                  <tr
                    className="hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => toggleRow(log.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-200">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {log.hostname}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityColors[log.severity] || "bg-gray-600"
                          }`}
                      >
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300 max-w-sm truncate">
                      {log.message}
                    </td>
                  </tr>
                  {expandedRow === log.id && (
                    <tr className="bg-gray-750 border-b border-gray-700">
                      <td
                        colSpan="4"
                        className="px-6 py-4 text-sm text-gray-200 whitespace-pre-wrap break-words bg-gray-800/50"
                      >
                        {typeof log.message === "string"
                          ? log.message.split(/\\n|\n/).map((line, i) => (
                            <div key={i}>{line}</div>
                          ))
                          : log.message}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td
                  colSpan="4"
                  className="px-6 py-4 text-center text-sm text-gray-400"
                >
                  Refresh to see logs
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
