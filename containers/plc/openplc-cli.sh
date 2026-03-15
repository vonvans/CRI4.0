#!/bin/bash

# openplc-cli device add <device_name> <device_address> <device_port>
if [ ! -f "/opt/OpenPLC_v3/webserver/mbconfig.cfg" ]; then
tee -a /opt/OpenPLC_v3/webserver/mbconfig.cfg << __EOF__
Num_Devices = "0"
Polling_Period = "100"
Timeout = "1000"
__EOF__
fi

NEW_DEVICE_NAME="$1"
NEW_DEVICE_ADDRESS="$2"
NEW_DEVICE_PORT="$3"

DEVICE_NUMBERS=$(grep -oP 'Num_Devices\s*=\s*"\K[0-9]+' /opt/OpenPLC_v3/webserver/mbconfig.cfg)
NEW_DEVICE_ID=${DEVICE_NUMBERS}
NEW_DEVICES_NUMBER="$((${DEVICE_NUMBERS} + 1))"
sed -i 's|^\(Num_Devices[[:space:]]*=[[:space:]]*"\)[0-9]\+\(".*\)$|\1'"${NEW_DEVICES_NUMBER}"'\2|' /opt/OpenPLC_v3/webserver/mbconfig.cfg

tee -a /opt/OpenPLC_v3/webserver/mbconfig.cfg << __EOF__
# ------------
#   DEVICE ${NEW_DEVICE_ID}
# ------------
device${NEW_DEVICE_ID}.name = "${NEW_DEVICE_NAME}"
device${NEW_DEVICE_ID}.slave_id = "0"
device${NEW_DEVICE_ID}.protocol = "TCP"
device${NEW_DEVICE_ID}.address = "${NEW_DEVICE_ADDRESS}"
device${NEW_DEVICE_ID}.IP_Port = "${NEW_DEVICE_PORT}"
device${NEW_DEVICE_ID}.RTU_Baud_Rate = "115200"
device${NEW_DEVICE_ID}.RTU_Parity = "None"
device${NEW_DEVICE_ID}.RTU_Data_Bits = "8"
device${NEW_DEVICE_ID}.RTU_Stop_Bits = "1"
device${NEW_DEVICE_ID}.RTU_TX_Pause = "0"

device${NEW_DEVICE_ID}.Discrete_Inputs_Start = "0"
device${NEW_DEVICE_ID}.Discrete_Inputs_Size = "8"
device${NEW_DEVICE_ID}.Coils_Start = "0"
device${NEW_DEVICE_ID}.Coils_Size = "8"
device${NEW_DEVICE_ID}.Input_Registers_Start = "0"
device${NEW_DEVICE_ID}.Input_Registers_Size = "8"
device${NEW_DEVICE_ID}.Holding_Registers_Read_Start = "0"
device${NEW_DEVICE_ID}.Holding_Registers_Read_Size = "8"
device${NEW_DEVICE_ID}.Holding_Registers_Start = "0"
device${NEW_DEVICE_ID}.Holding_Registers_Size = "8"
__EOF__


sqlite3 /opt/OpenPLC_v3/webserver/openplc.db <<EOF
INSERT INTO Slave_dev (dev_id,dev_name,dev_type,slave_id,com_port,baud_rate,parity,data_bits,stop_bits,ip_address,ip_port,di_start,di_size,coil_start,coil_size,ir_start,ir_size,hr_read_start,hr_read_size,hr_write_start,hr_write_size,pause) VALUES (${NEW_DEVICES_NUMBER}, '${NEW_DEVICE_NAME}', 'TCP', 0, NULL, 115200, 'None', 8, 1, '${NEW_DEVICE_ADDRESS}', ${NEW_DEVICE_PORT}, 0, 8, 0, 8, 0, 8, 0, 8, 0, 8, 0);
EOF


# openplc-cli program add  <st_file> <program_name> <program_description>

ST_FILE="/shared/fan_control.st"
PROGRAM_NAME="fancontrol"
PROGRAM_DESCRIPTION="control the fan"

CODE_ID="$(shuf -i 100000-999999 -n 1).st"
cp ${ST_FILE} /opt/OpenPLC_v3/webserver/st_files/${CODE_ID}

cd  /opt/OpenPLC_v3/webserver/scripts/
./compile_program.sh ${CODE_ID}
cd -

sqlite3 /opt/OpenPLC_v3/webserver/openplc.db <<SQL
INSERT INTO Programs
(Name, Description, File, Date_upload)
VALUES
('${PROGRAM_NAME}', '${PROGRAM_DESCRIPTION}', '${CODE_ID}', strftime('%s','now'));
SQL


# openplc-cli settings set <key> <value>
KEY="Start_run_mode"
VALUE="true"

sqlite3 /opt/OpenPLC_v3/webserver/openplc.db <<'SQL'
UPDATE Settings
SET Value = '${VALUE}'
WHERE Key = '${KEY}';
SQL
