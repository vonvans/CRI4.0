#!/usr/bin/env python3
from pymodbus.server import StartTcpServer
from pymodbus.datastore import ModbusServerContext, ModbusSlaveContext, ModbusSequentialDataBlock
from pymodbus.device import ModbusDeviceIdentification  # solo se <3.0
import logging
import random
import time
import threading
import argparse


	
# Enable logging
logging.basicConfig()
log = logging.getLogger()
log.setLevel(logging.INFO)
identity = ModbusDeviceIdentification()
store = ModbusSlaveContext(
	di=ModbusSequentialDataBlock(0, [0]*16),  # Discrete Inputs
	co=ModbusSequentialDataBlock(0, [0]*16),  # Coils
	hr=ModbusSequentialDataBlock(0, [0]*16),  # Holding Registers
	ir=ModbusSequentialDataBlock(0, [0]*16)   # Input Registers
)
context = ModbusServerContext(slaves=store, single=True)
def update_values(context):
    slave_id = 0x00
    while True:
        value = random.randint(0, 1000)
        context[slave_id].setValues(4, 0, [value])  # HR0
        print(f"[update] HR0 = {value}")
        time.sleep(2)

threading.Thread(target=update_values, args=(context,), daemon=True).start()
parser = argparse.ArgumentParser(description="modbusTCP")
parser.add_argument("-a", "--address", required=False, default="0.0.0.0", help="ModbusTCP Address")
parser.add_argument("-p", "--port", required=False, default=1502, help="ModbusTCP port")
args = parser.parse_args()
	
# Start the server
print(f"Server has started on port {args.port}")
StartTcpServer(context, identity=identity, address=(args.address, args.port))
