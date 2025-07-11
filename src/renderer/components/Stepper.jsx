/* eslint-disable react/no-array-index-key */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Button, Card } from "@nextui-org/react";
import { useEffect, useState } from "react";
import toast, {Toaster} from 'react-hot-toast';

function Stepper({machines, onComplete}) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: "Step 1",
      content: "Create an Attacker machine",
    },
    {
      title: "Step 2",
      content: "Create at least a second machine in the network",
    }
  ];

  useEffect(() => {
    if (machines.find((m) => m.type === "attacker" && m.name !== "")){
        setActiveStep(1)
        if (machines.length > 1){
            if (machines.every((m) => m.name !== "")){
                onComplete(false)
            } else {
                toast.error('Check machines names')
            }
        } else {
            toast.error('Add more machines')
        }
    }
}, [machines, onComplete])

  return (
    <div className="flex flex-col items-center space-y-8 ">
      <div className="w-full">
        {steps.map((step, index) => (
          <div key={index} className="flex space-x-4 items-start p-2">
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                activeStep === index
                  ? "bg-primary border-primary text-white"
                  : "bg-transparent border-gray-300"
              }`}
            >
              {index + 1}
            </div>
            <div className="flex flex-col space-y-2">
              <h2 className="text-xl font-bold">
                {step.title}
              </h2>
              {activeStep === index && (
                <Card className="p-4">
                  <p className="text-gray-500">{step.content}</p>
                </Card>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="w-full">
        <Toaster containerStyle={{
            position: 'relative',
        }}/>
      </div>
    </div>
  );
}

export default Stepper;
