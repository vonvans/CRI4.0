/* eslint-disable eqeqeq */
/* eslint-disable react/no-array-index-key */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { useState, useEffect, PureComponent } from "react";
import { Treemap, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button, Card, CardBody, CardHeader } from "@nextui-org/react";

function Report() {
  const [data, setData] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [machines, setMachines] = useState(() => {
    const savedMachines = localStorage.getItem("machines");
    return savedMachines ? JSON.parse(savedMachines) : [];
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      const fetchData = async () => {
        try {
          const results = await Promise.all(
            machines.filter(m => m.name != "attacker").map(machine =>
              fetch(`http://localhost:1337/collect?hostname=${machine.name}`)
              .then(response => {
                return response.json()
              })
              .catch(error => {
                setFetching(false)
                return null
              })
          ));
          setData(results);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };

      fetchData();
    }, 1000);

    return () => clearInterval(intervalId);
  }, [machines]);

  console.log(data)

  return (
    <div>
      {data.every(m => m == null) && (
        <div className="min-h-[calc(100vh-4rem)] grid place-items-center gap-2 p-4">
          <h1>No data available</h1>
        </div>
      ) || (
      <div className="min-h-[calc(100vh-4rem)] grid grid-cols-2 grid-rows-2 gap-2 p-4">
        {data.some(m => m != null) && data.map((machine, index) => (
          <div key={index} className="h-full">
              <Card className="h-full">
                <CardHeader>
                  <div className="grid w-full bg-content2 p-1 rounded-lg justify-items-center">
                    <h1>{machine && machine[0].hostname}</h1>
                  </div>
                </CardHeader>
                <CardBody className="h-full grid gap-2">
                  <h1>CPU</h1>
                  <ResponsiveContainer height="100%" width="100%">
                      <AreaChart
                        data={machine && machine.map((d, i) => ({
                          name: i,
                          last1min: d.cpu.last1min,
                          last5min: d.cpu.last5min,
                          last15min: d.cpu.last15min
                        })).reverse()}
                        margin={{
                          top: 0,
                          right: 0,
                          left: 0,
                          bottom: 0,
                        }}
                      >
                        <Tooltip />
                        <Area type="monotone" dataKey="last1min" stroke="#8884d8" fill="#8884d8" />
                        <Area type="monotone" dataKey="last5min" stroke="#82ca9d" fill="#82ca9d" />
                        <Area type="monotone" dataKey="last15min" stroke="#ffc658" fill="#ffc658" />
                      </AreaChart>
                  </ResponsiveContainer>
                  <h1>RAM</h1>
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap width={400} height={200} data={
                      [{
                        name: "used",
                        children: [
                          { name: 'used', size: machine[0].ram.used }
                        ]
                      },
                      {
                        name: "free",
                        children: [
                          { name: 'free', size: machine[0].ram.free }
                        ]
                      },
                      {
                        name: "available",
                        children: [
                          { name: 'available', size: machine[0].ram.available }
                        ]
                      }]
                    } dataKey="size" aspectRatio={4 / 3} stroke="#fff" fill="#8884d8" />
                  </ResponsiveContainer>
                  <Button size="sm" color="secondary">Details</Button>
                </CardBody>
              </Card>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

export default Report;
