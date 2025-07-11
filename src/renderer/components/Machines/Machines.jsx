/* eslint-disable no-return-assign */
/* eslint-disable react/self-closing-comp */
/* eslint-disable no-unneeded-ternary */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {useMemo, useState, useEffect} from "react";
import {Table, TableHeader, TableColumn, TableBody, TableRow, TableCell} from "@nextui-org/table";
import {Skeleton} from '@nextui-org/react'
import {Button} from "@nextui-org/button";
import { Divider } from "@nextui-org/react";
import React from 'react';
import { MachineInfo } from "./MachineInfo";
import { NetworkInterface } from "./NetworkInterface";
import { Gateway } from "./Gateway";
import { AdditionalFunctions } from "./AdditionalFunctions/AdditionalFunctions";
import {XSymbol} from '../Symbols/XSymbol';
import {MinusSymbol} from '../Symbols/MinusSymbol';
import {PlusSymbol} from '../Symbols/PlusSymbol';
import {backboneModel} from '../../models/model.js';

export function Machines({machines, setMachines, componentRefs}) {
    const classNames = useMemo(
      () => ({
        td: ["h-96"],
      }), [])

    useEffect(() => {
      localStorage.setItem("machines", JSON.stringify(machines));
    }, [machines]);

    function addMachine(){
      setMachines(() => ([
        ...machines,
        {
          id: crypto.randomUUID(),
         ...backboneModel
        }
      ]))
    }

    function removeMachine(machine){
      if (machines.length === 1){
        setMachines([{
          id: crypto.randomUUID(),
         ...backboneModel
        }])
      } else {
        setMachines(
          machines.filter(m =>
            m.id !== machine.id
          )
        );
      }
    }

    return (
      <div>
        <Table
          aria-label="Machines table"
          classNames={classNames}
          className="rounded-t-lg"
          bottomContent={
            <div className="grid justify-items-center items-center">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  aria-label="Add machine"
                  onClick={addMachine}
                  size="sm"
                  color="success"
                  className="text-white"
                  endContent={
                    <PlusSymbol fill="white" size={22} />
                  }> Add Machine </Button>
                <Button isDisabled={machines.length > 0 ? false : true} aria-label="Clear all machine"
                onClick={() => setMachines([{
                  id: crypto.randomUUID(),
                  ...backboneModel
                }])}
                size="sm" color="danger" endContent={<XSymbol size={22} />}>
                  Clear All Machines
                </Button>
              </div>
            </div>
        }>
          <TableHeader>
            <TableColumn className="w-0"></TableColumn>
            <TableColumn>Machines Informations</TableColumn>
            <TableColumn>Network Interfaces</TableColumn>
            <TableColumn>Gateway (static)</TableColumn>
            <TableColumn>Additional functions</TableColumn>
          </TableHeader>
          <TableBody>
            {machines.map((machine, index) => (
              <TableRow key={machine.id} >
                <TableCell>
                  <div className="h-full" ref={(el) => componentRefs.current[index] = el}>
                    <div className="grid content-start">
                      <Button aria-label="Remove machine" isIconOnly size="sm" color="danger" onClick={() => removeMachine(machine)}>
                        <XSymbol size={22} />
                      </Button>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <MachineInfo id={index} machine={machine} machines={machines} setMachines={setMachines} />
                </TableCell>
                <TableCell>
                  <NetworkInterface machine={machine} machines={machines} setMachines={setMachines} />
                </TableCell>
                <TableCell>
                  <Gateway machine={machine} machines={machines} setMachines={setMachines} />
                </TableCell>
                <TableCell>
                  <AdditionalFunctions machine={machine} machines={machines} setMachines={setMachines} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
}
