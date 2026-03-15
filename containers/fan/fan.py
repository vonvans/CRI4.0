#!/usr/bin/env python3
import requests
import pymodbus
import argparse
from pymodbus.server import StartTcpServer
from pymodbus.datastore import ModbusServerContext, ModbusDeviceContext, ModbusSequentialDataBlock
from pymodbus.pdu.device import ModbusDeviceIdentification
import logging
import random
import time
import threading

import os

# Argument parsing
parser = argparse.ArgumentParser(description="modbusTCP")
parser.add_argument("-a", "--address", required=False, default="0.0.0.0", help="ModbusTCP Address")
parser.add_argument("-p", "--port", required=False, default=502, type=int, help="ModbusTCP port")
parser.add_argument("-c", "--capacity", required=False, default=float(os.environ.get("CAPACITY", 2.0)), type=float, help="Fan capacity")
parser.add_argument("-e", "--endpoint", required=False, default=os.environ.get("ENDPOINT", "http://localhost:8000/"), help="Endpoint API REST")
parser.add_argument("-ft", "--fetch-time", required=False, default=1.0, type=float, help="Fetch time in seconds")
args = parser.parse_args()

# Enable logging
logging.basicConfig()
log = logging.getLogger()
log.setLevel(logging.INFO)

DISCRETE_INPUTS=16
COILS=16
HOLDING_REGS=16
INPUT_REGS=16

store = ModbusDeviceContext(
	di=ModbusSequentialDataBlock(0, [0]*DISCRETE_INPUTS),  # Discrete Inputs
	co=ModbusSequentialDataBlock(0, [0]*COILS),  # Coils
	hr=ModbusSequentialDataBlock(0, [0]*HOLDING_REGS),  # Holding Registers
	ir=ModbusSequentialDataBlock(0, [0]*INPUT_REGS)   # Input Registers
)
context = ModbusServerContext(devices=store, single=True)

def update_values(context):
    while True:
        if context[0].getValues(1, 0, count=1)[0] == 0:
            log.info("Fan is stopped. Waiting...")
            time.sleep(1)
            continue
        power = context[0].getValues(3, 0, count=1)[0]
        if power == 0:
            power = 1
        log.info(f"Read power: {power}")


        try:
            response = requests.get(args.endpoint + "engine")
            if response.status_code == 200:
                data = response.json()
                temperature = data.get("temperature")
                
                if temperature is not None:
                    context[0].setValues(4, 0, [int(temperature)])
                    log.info(f"Read temperature: {temperature}")
                    new_temperature = temperature - power * args.capacity
                    post_url = args.endpoint + "engine/temperature"
                    payload = {"temperature": new_temperature}
                    post_response = requests.post(post_url, json=payload)
                    if post_response.status_code == 200:
                        log.info(f"Decreased temperature to {new_temperature}")
                    else:
                        log.error(f"Failed to decrease temperature. Status: {post_response.status_code}")
                else:
                    log.warning("No temperature in response")
            else:
                log.error(f"Error fetching endpoint: {response.status_code}")
        except Exception as e:
            log.error(f"Exception in update loop: {e}")
            
        time.sleep(args.fetch_time)

threading.Thread(target=update_values, args=(context,), daemon=True).start()
	

# Start the server
print(f"Server has started on port {args.port}")
identity = ModbusDeviceIdentification()
identity.VendorName = 'Pymodbus'
identity.ProductCode = 'PM'
identity.VendorUrl = 'http://github.com/riptideio/pymodbus/'
identity.ProductName = 'Pymodbus Server'
identity.ModelName = 'Pymodbus Server'
identity.MajorMinorRevision = '1.0'

StartTcpServer(context=context, identity=identity, address=(args.address, args.port))
