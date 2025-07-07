/* eslint-disable react/no-unknown-property */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { useState, useEffect, useContext } from "react";
import { Card, CardBody, Textarea } from "@nextui-org/react";
import { LogContext } from "../contexts/LogContext";

function Logs() {
  const {logs} = useContext(LogContext);

  return (
    <div className="grid min-h-[calc(100vh-4rem)] gap-2 p-4">
      { logs.length === 0 && (
        <div>
          <Card className="h-full w-full">
            <CardBody className="grid place-items-center">
              <h1>No logs</h1>
            </CardBody>
          </Card>
        </div>
      ) || (
        <div>
          <div className="rounded-xl bg-content1 h-full p-4">
            <textarea className="w-full font-normal bg-transparent !outline-none placeholder:text-foreground-500 focus-visible:outline-none data-[has-start-content=true]:ps-1.5 data-[has-end-content=true]:pe-1.5 file:cursor-pointer file:bg-transparent file:border-0 autofill:bg-transparent bg-clip-text text-small resize-none data-[hide-scroll=true]:scrollbar-hide group-data-[has-value=true]:text-default-foreground transition-height !duration-100 motion-reduce:transition-none h-full is-filled"
              readOnly
              value={logs.join("\n")}
            />
          </div>
          <style jsx="true">{`
              [data-slot="input-wrapper"] {
                  height: 100% !important;
              }
              textarea {
                  height: 100% !important;
              }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default Logs;
