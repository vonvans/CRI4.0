
import threading
import time
import argparse
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from pymodbus.server import StartTcpServer
from pymodbus.datastore import ModbusServerContext, ModbusDeviceContext, ModbusSequentialDataBlock
from pymodbus.pdu.device import ModbusDeviceIdentification
import logging
import random
import time
import threading
import argparse


class TemperatureUpdate(BaseModel):
    temperature: float

class Engine:
    def __init__(self, temp_step, interval_seconds, start_temp=0.0):
        self.temperature = start_temp
        self.status = "stopped"
        self.temp_step = temp_step
        self.interval_seconds = interval_seconds
        self.running = False
        self._thread = None
        threading.Thread(target=self._cooling_loop, daemon=True).start()

    def start(self):
        if not self.running:
            self.running = True
            self.status = "running"
            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()

    def stop(self):
        if self.running:
            self.running = False
            self.status = "stopped"
            threading.Thread(target=self._cooling_loop, daemon=True).start()

    def _run_loop(self):
        while self.running:
            time.sleep(self.interval_seconds)
            self.temperature += self.temp_step

    def _cooling_loop(self):
        while not self.running:
            time.sleep(self.interval_seconds)
            if self.temperature > 0:
                self.temperature = max(0.0, self.temperature - self.temp_step)

    def get_state(self):
        return {
            "temperature": self.temperature,
            "status": self.status
        }

    def set_temperature(self, temp):
        self.temperature = temp

# Global engine instance
engine = None

app = FastAPI()

@app.get("/engine")
def get_engine_status():
    global engine
    if engine:
        return engine.get_state()
    return {"error": "Engine not initialized"}

@app.post("/engine/temperature")
def set_engine_temperature(update: TemperatureUpdate):
    global engine
    if engine:
        engine.set_temperature(update.temperature)
        return engine.get_state()
    return {"error": "Engine not initialized"}

@app.get("/")
def root():
    return get_engine_status()

def monitor_modbus(context):
    global engine
    
    slave_id = 0x00
    address = 0x00
    
    while True:
        try:
            # Read holding register 0
            # getValues returns a list
            values = context[slave_id].getValues(3, address, count=1)
            val = values[0]
            
            if engine:
                if val == 1 and not engine.running:
                    engine.start()
                elif val == 0 and engine.running:
                    engine.stop()
                    
        except Exception as e:
            print(f"Error in modbus monitor: {e}")
            
        time.sleep(0.5)

def run_modbus_server(context):
    # Retry loop for Modbus server
    while True:
        try:
            StartTcpServer(context=context, address=("0.0.0.0", 502))
        except Exception as e:
            print(f"Modbus server failed to start or crashed: {e}. Retrying in 2 seconds...")
            time.sleep(2)

import socket

def bind_socket_robust(host, port, retries=5, delay=2):
    """
    Attempts to bind a socket to the given host and port.
    Retries on failure (e.g., address already in use).
    Returns the bound socket object.
    """
    for attempt in range(retries):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((host, port))
            return sock
        except OSError as e:
            print(f"Bind attempt {attempt + 1}/{retries} failed: {e}")
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                raise e

def main():
    global engine
    parser = argparse.ArgumentParser(description="Engine Simulator")
    parser.add_argument("-i", "--interface", type=str, required=False, default="0.0.0.0", help="Interface to bind to")
    parser.add_argument("-p", "--port", type=int, required=False, default=8000, help="Port to bind to") 
    parser.add_argument("-t", "--temperature-step", type=float, required=False, default=+1, help="Temperature increase step")
    parser.add_argument("-s", "--seconds", type=float, required=False, default=1, help="Time interval in seconds")
    parser.add_argument("-ts", "--temperature-start", type=float, required=False, default=30, help="Temperature start value")
    args = parser.parse_args()

    # start modbus server
    store = ModbusDeviceContext(
        hr=ModbusSequentialDataBlock(0, [0]*100),
        co=ModbusSequentialDataBlock(0, [0]*100),
        di=ModbusSequentialDataBlock(0, [0]*100),
        ir=ModbusSequentialDataBlock(0, [0]*100),
    )

    context = ModbusServerContext(
        devices=store,
        single=True
    )

    threading.Thread(
        target=run_modbus_server,
        args=(context,),
        daemon=True
    ).start()

    # start API REST
    engine = Engine(args.temperature_step, args.seconds, args.temperature_start)
    
    # Start Modbus monitor thread
    threading.Thread(target=monitor_modbus, args=(context,), daemon=True).start()

    print(f"Starting Engine with step={args.temperature_step}, interval={args.seconds}, start_temp={args.temperature_start}")
    
    # Robustly bind the socket and pass it to Uvicorn
    # This prevents the race condition where the port is released and stolen before Uvicorn starts
    try:
        sock = bind_socket_robust(args.interface, args.port)
        # Verify if we need to listen(), uvicorn usually expects a bound socket.
        # Calling listen is safe.
        # sock.listen(5) # Optional, uvicorn might do it, but let's be safe if we pass FD.
        # Actually, let's look at how uvicorn handles it. 
        # If we just bind, uvicorn will call listen.
        
        print(f"Socket successfully bound to {args.interface}:{args.port}. Passing FD to Uvicorn...")
        
        # Pass the file descriptor to Uvicorn
        # Note: When using fd, host/port args in run() are typically ignored for binding but used for logging.
        uvicorn.run(app, fd=sock.fileno(), host=args.interface, port=args.port)
        
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to start engine server: {e}")
        # If we failed to bind after retries, we exit.

if __name__ == "__main__":
    main()
