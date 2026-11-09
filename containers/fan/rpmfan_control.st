PROGRAM FanControl
  VAR
    Temperature AT %IW100 : INT;
    Fan AT %QW100 : INT;
  END_VAR

  (* Hysteresis Control *)
  IF Temperature >= 90 THEN
    Fan := 1000;
  ELSIF Temperature < 50 THEN
    Fan := 0;
  END_IF;

END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : FanControl;
  END_RESOURCE
END_CONFIGURATION
