import { useEffect, useContext, useRef } from "react";
import { Card, CardBody } from "@nextui-org/react";
import { LogContext } from "../contexts/LogContext";

function Logs() {
  const { logs } = useContext(LogContext);
  const logsEndRef = useRef(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  return (
    <div className="grid min-h-[calc(100vh-4rem)] gap-2 p-4">
      {logs.length === 0 ? (
        <div>
          <Card className="h-full w-full">
            <CardBody className="grid place-items-center">
              <h1>No logs</h1>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="rounded-xl bg-content1 h-full p-4 overflow-y-auto">
          <pre className="w-full font-normal bg-transparent !outline-none text-small whitespace-pre-wrap">
            {logs.join("\n")}
          </pre>
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}

export default Logs;
