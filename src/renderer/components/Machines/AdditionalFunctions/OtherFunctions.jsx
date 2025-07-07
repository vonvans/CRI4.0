/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable no-unneeded-ternary */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable no-else-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
import {Button} from "@nextui-org/button";
import { Input } from "@nextui-org/react";
import { Textarea } from "@nextui-org/react";
import {PlusSymbol} from '../../Symbols/PlusSymbol';
import {MinusSymbol} from '../../Symbols/MinusSymbol';

export function OtherFunctions({machine, machines, setMachines}) {
    function handleChange(e, index, data){
        setMachines(machines.map((m) => {
            if (m.id === machine.id){
                return {
                    ...m,
                    other: data
                }
            // eslint-disable-next-line no-else-return
            } else {
                return m
            }
        }))
    }

    function addFile(e, data){
        setMachines(machines.map((m) => {
            if (m.id === machine.id){
                return {
                    ...m,
                    other: {
                        ...m.other,
                        files: [
                            ...m.other.files,
                            {
                                name: "",
                                contents: ""
                            }
                        ],
                        fileCounter: m.other.fileCounter + 1
                    }
                }
            // eslint-disable-next-line no-else-return
            } else {
                return m
            }
        }))
    }

    function removeFile(e, data){
        setMachines(machines.map((m) => {
            if (m.id === machine.id){
                return {
                    ...m,
                    other: {
                        ...m.other,
                        files: m.other.files.slice(0, m.other.files.length - 1),
                        fileCounter: m.other.fileCounter - 1
                    }
                }
            } else {
                return m
            }
        }))
    }

    return (
        <div>
            <div className="grid gap-2">
                <div className="grid grid-cols-5 grid-rows-1 gap-2">
                    <Button className="col-span-4" onClick={addFile} aria-label="Add Interface" size="sm" color="success" endContent={<PlusSymbol fill="white" size={22} />}>
                            Add File
                    </Button>
                    <Button isDisabled={1 ? false : true} onClick={removeFile} aria-label="Remove Interface" size="sm" color="danger">
                            <MinusSymbol fill="white" size={22} />
                    </Button>
                </div>
                <div className="pb-2">
                    <label className="text-text/50">files will be stored in /etc/scripts/</label>
                </div>
            </div>
            <div className="grid gap-2">
                {machine.other.files.map((fl, index) => (
                    <div key={index} className="grid gap-2">
                        <Input
                            type="text"
                            variant="flat"
                            label="File name"
                            placeholder="my_switch.p4"
                            value={fl.name || ""}
                            onChange={(e) => handleChange(e, index, {
                                ...machine.other,
                                files: machine.other.files.map((file, idx) => {
                                    if (idx === index){
                                        return {
                                            ...file,
                                            name: e.target.value
                                        }
                                    } else {
                                        return file
                                    }
                                })
                            })}
                        />
                        <Textarea
                            type="text"
                            variant="flat"
                            label="File contents"
                            placeholder=" "
                            value={fl.contents || ""}
                            onChange={(e) => handleChange(e, index, {
                                ...machine.other,
                                files: machine.other.files.map((file, idx) => {
                                    if (idx === index){
                                        return {
                                            ...file,
                                            contents: e.target.value
                                        }
                                    } else {
                                        return file
                                    }
                                })
                            })}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}
