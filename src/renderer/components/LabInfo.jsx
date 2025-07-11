/* eslint-disable no-unneeded-ternary */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import {Accordion, AccordionItem} from "@nextui-org/accordion";
import {Input} from "@nextui-org/input";
import {Button} from "@nextui-org/button";
import { useState, useEffect } from 'react';
import {XSymbol} from './Symbols/XSymbol';
import { labInfoModel } from "../models/model";

export function LabInfo({labInfo, setLabInfo}) {
    useEffect(() => {
        localStorage.setItem("labInfo", JSON.stringify(labInfo));
    }, [labInfo]);

    return (
        <div className="w-full">
            <Accordion variant="splitted">
                <AccordionItem key="1" aria-label="lab-info" title="Lab Informations">
                <div className="grid gap-2">
                    <Input
                        type="text"
                        label="Description"
                        placeholder="Exam 2-A 'Harpoon'"
                        value={labInfo.description || ""}
                        onChange={(e) => setLabInfo({ ...labInfo, description: e.target.value })}
                    />
                    <Input
                        type="text"
                        label="Version"
                        placeholder="1.0"
                        value={labInfo.version || ""}
                        onChange={(e) => setLabInfo({ ...labInfo, version: e.target.value })}
                    />
                    <Input
                        type="text"
                        label="Authors"
                        placeholder="M. Rossi, F. Bianchi"
                        value={labInfo.authors || ""}
                        onChange={(e) => setLabInfo({ ...labInfo, authors: e.target.value })}
                    />
                    <Input
                        type="text"
                        label="Email"
                        placeholder="m.rossi@email.com"
                        value={labInfo.email || ""}
                        onChange={(e) => setLabInfo({ ...labInfo, email: e.target.value })}
                    />
                    <Input
                        type="text"
                        label="Website"
                        placeholder="http://yoursite.com"
                        value={labInfo.website || ""}
                        onChange={(e) => setLabInfo({ ...labInfo, website: e.target.value })}
                    />
                    <div className="grid items-center">
                    <Button isDisabled={Object.values(labInfo).every(value => value === "") ? true : false} aria-label="Clear all machine"
                        onClick={() => {setLabInfo(labInfoModel)}}
                        size="sm" color="danger" endContent={<XSymbol size={22} />}>
                        Clear All
                        </Button>
                    </div>
                </div>
                </AccordionItem>
            </Accordion>
        </div>
    )
}
