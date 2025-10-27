/* eslint-disable no-else-return */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { useState, useEffect } from "react";
import { RadioGroup, Radio } from "@nextui-org/radio";
import { Input } from "@nextui-org/input";
import { Switch } from "@nextui-org/switch";
import { Accordion, AccordionItem } from "@nextui-org/react";

export function MachineInfo({ id, machine, machines, setMachines }) {
  function handleChange(value, data) {
    setMachines(() =>
      machines.map((m) => {
        if (m.id === machine.id) {
          return data;
        } else {
          return m;
        }
      })
    );
  }

  const attackerExistsElsewhere = machines.some(
    (m) => m.type === "attacker" && m.id !== machine.id
  );

  const exactlyOneOtherController =
    machines.filter((m) => m.type === "controller" && m.id !== machine.id).length === 1;

  return (
    <div className="h-full">
      <div className="grid content-start gap-2">
        <div>
          <Input
            type="text"
            variant="underlined"
            placeholder={`pc${id}`}
            value={machine.name}
            onValueChange={(value) =>
              handleChange(value, {
                ...machine,
                name: value.toLocaleLowerCase(),
              })
            }
          />
          <div className="mt-2">
            <Switch
              isSelected={!!machine.bridged}
              onValueChange={(val) =>
                setMachines((ms) =>
                  ms.map((m) => (m.id === machine.id ? { ...m, bridged: val } : m))
                )
              }
            >
              Online (bridged)
            </Switch>
          </div>
        </div>

        <div className="row-span-7">
          <Accordion
            selectionMode="multiple"
            defaultExpandedKeys={["general", "attack", "defence", "industrial", "other"]}
            className="mt-2"
          >
            {/* GENERAL */}
            <AccordionItem key="general" aria-label="General" title="General">
              <RadioGroup
                color="primary"
                value={machine.type}
                onValueChange={(value) =>
                  handleChange(value, {
                    ...machine,
                    type: value,
                  })
                }
              >
                <Radio value="terminal">Terminal</Radio>
                <Radio value="router">Router</Radio>
                <Radio value="ws">Web Server</Radio>
                <Radio value="ns">Name Server</Radio>
              </RadioGroup>
            </AccordionItem>

            {/* ATTACK */}
            <AccordionItem key="attack" aria-label="Attack" title="Attack">
              <RadioGroup
                color="primary"
                value={machine.type}
                onValueChange={(value) =>
                  handleChange(value, {
                    ...machine,
                    type: value,
                  })
                }
              >
                <Radio isDisabled={attackerExistsElsewhere} value="attacker">
                  Attacker
                </Radio>
              </RadioGroup>
            </AccordionItem>

            {/* DEFENCE */}
            <AccordionItem key="defence" aria-label="Defence" title="Defence">
              <RadioGroup
                color="primary"
                value={machine.type}
                onValueChange={(value) =>
                  handleChange(value, {
                    ...machine,
                    type: value,
                  })
                }
              >
                <Radio value="ngfw">NGFW Appliance</Radio>
              </RadioGroup>
            </AccordionItem>

            {/* INDUSTRIAL */}
            <AccordionItem key="industrial" aria-label="Industrial" title="Industrial">
              <RadioGroup
                color="primary"
                value={machine.type}
                onValueChange={(value) =>
                  handleChange(value, {
                    ...machine,
                    type: value,
                  })
                }
              >
                <Radio value="rejector">Rejector</Radio>
                <Radio value="scada">Scada controller</Radio>
                <Radio value="apg">Abstract piece generator</Radio>
                <Radio value="laser">Laser sensor</Radio>
                <Radio value="conveyor">Conveyor</Radio>
                <Radio value="plc">PLC</Radio>
              </RadioGroup>
            </AccordionItem>

            {/* OTHER */}
            <AccordionItem key="other" aria-label="Other" title="Other">
              <RadioGroup
                color="primary"
                value={machine.type}
                onValueChange={(value) =>
                  handleChange(value, {
                    ...machine,
                    type: value,
                  })
                }
              >
                {exactlyOneOtherController ? (
                  <Radio value="switch">Open vSwitch</Radio>
                ) : (
                  <Radio value="controller">OpenFlow Ryu Controller</Radio>
                )}
                <Radio value="other">Other</Radio>
              </RadioGroup>

              {machine.type === "other" && (
                <div className="mt-2">
                  <Input
                    type="text"
                    label="Image Name"
                    variant="underlined"
                    placeholder="example p4"
                    value={machine.other?.image ?? ""}
                    onValueChange={(value) =>
                      handleChange(value, {
                        ...machine,
                        other: {
                          ...(machine.other ?? {}),
                          image: value,
                        },
                      })
                    }
                  />
                </div>
              )}
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}