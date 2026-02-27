#!/bin/bash
modtester << __EOF__ 2>&1 | cat > pipe_output.txt
use modbus/scanner/discreteInputDiscover
set RHOSTS 172.17.0.2
set RPORT 502
set UID 1
exploit
exit
__EOF__
