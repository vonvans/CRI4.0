/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { Button } from "@nextui-org/react"
import { DownloadSymbol } from "./Symbols/DownloadSymbol"
import { makeDownload, generateScript, generateZip } from "../scripts/make"

export function Download({machines, labInfo}) {
    return (
        <div className="grid gap-2">
            <div>
                <div className="grid p-2 justify-items-center">
                    <h1 className="text-2xl">Download</h1>
                </div>
                <div className="grid gap-2">
                    <Button onClick={() => generateZip(machines, labInfo)} startContent={<DownloadSymbol />}>Download ZIP</Button>
                    <Button onClick={() => makeDownload(generateScript(machines, labInfo), 'netkit.script')} startContent={<DownloadSymbol />}>Download Script</Button>
                </div>
            </div>
        </div>
    )
}
