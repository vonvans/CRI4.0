
import time
import requests
from pymodbus.client import ModbusTcpClient

def check_status(expected_status):
    try:
        r = requests.get("http://localhost:8000/engine")
        data = r.json()
        status = data.get("status")
        print(f"Engine status: {status}")
        if status != expected_status:
            print(f"FAIL: Expected {expected_status}, got {status}")
            return False
        return True
    except Exception as e:
        print(f"Error checking status: {e}")
        return False

def test():
    client = ModbusTcpClient('localhost', port=5022)
    client.connect()

    print("--- Test 1: Initial State (Should be stopped) ---")
    if not check_status("stopped"):
        return

    print("\n--- Test 2: Start Engine (Write 1 to Register 0) ---")
    client.write_register(0, 1)
    time.sleep(2) # Give some time for the monitor loop
    if not check_status("running"):
        return

    print("\n--- Test 3: Stop Engine (Write 0 to Register 0) ---")
    client.write_register(0, 0)
    time.sleep(2)
    if not check_status("stopped"):
        return
    
    print("\nSUCCESS: All tests passed!")
    client.close()

if __name__ == "__main__":
    test()
