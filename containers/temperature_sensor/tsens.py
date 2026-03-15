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

import math

# Argument parsing
parser = argparse.ArgumentParser(description="modbusTCP")
parser.add_argument("-a", "--address", required=False, default="0.0.0.0", help="ModbusTCP Address")
parser.add_argument("-p", "--port", required=False, default=502, type=int, help="ModbusTCP port")
parser.add_argument("-ft", "--fetch-time", required=False, default=1.0, type=float, help="Fetch time seconds")
parser.add_argument("-e", "--endpoint", required=False, default="http://localhost:8000/", help="Endpoint API REST")
# Sine wave arguments
parser.add_argument("--sine", action="store_true", help="Enable sine wave simulation mode")
parser.add_argument("--period", type=float, default=60.0, help="Period of the sine wave in seconds")
parser.add_argument("--amplitude", type=float, default=10.0, help="Amplitude of the sine wave")
parser.add_argument("--offset", type=float, default=25.0, help="Vertical offset (average temperature)")

args = parser.parse_args()

# Auto-adjust fetch time for sine wave to avoid aliasing
if args.sine:
    # We want at least 10 samples per period for a smooth wave
    max_fetch_time = args.period / 10.0
    if args.fetch_time > max_fetch_time:
        # Limit the minimum fetch time to avoid CPU hogging, e.g., 0.01s
        new_fetch_time = max(max_fetch_time, 0.01)
        print(f"WARNING: Fetch time {args.fetch_time}s is too slow for sine period {args.period}s. Auto-adjusting to {new_fetch_time:.3f}s.")
        args.fetch_time = new_fetch_time

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
	start_time = time.time()
	while True:
		try:
			temperature = None
			if args.sine:
				# Calculate sine wave temperature
				current_time = time.time() - start_time
				# Formula: offset + amplitude * sin(2 * pi * t / period)
				val = args.offset + args.amplitude * math.sin(2 * math.pi * current_time / args.period)
				temperature = val
				log.info(f"Generated sine temperature: {temperature:.2f}")
			else:
				# Fetch from endpoint
				response = requests.get(args.endpoint)
				if response.status_code == 200:
					data = response.json()
					temperature = data.get("temperature")
					if temperature is None:
						log.warning("No temperature in response")
				else:
					log.error(f"Error fetching endpoint: {response.status_code}")
			
			if temperature is not None:
				# Update Input Register (Function Code 4) address 0 with temperature
				# We cast to int because Modbus registers are essentially integers
				context[0].setValues(4, 0, [int(temperature)])
				log.info(f"Updated temperature to {int(temperature)}")

		except Exception as e:
			log.error(f"Exception in fetching: {e}")
		
		time.sleep(args.fetch_time)

threading.Thread(target=update_values, args=(context,), daemon=True).start()
	
# Start the server
print(f"Server has started on port {args.port}")
StartTcpServer(context=context, address=(args.address, args.port))
