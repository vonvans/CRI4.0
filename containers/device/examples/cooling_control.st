(*
  Cooling control for the "device" physics simulation.

  Reads the reactor temperature from the thermowell and opens the cooling
  valve proportionally to lower it.

  I/O mapping (OpenPLC slave devices, attached from %IW100 / %QW100 onward):
    device_temp_sensor     %IW100  reactor_temp  (input reg 100, degC x100)
    device_valve_actuator  %IW101  target_pos readback (holding reg 200)
                           %IW102  actual_pos          (holding reg 201)
                           %QW100  target_pos command  (holding reg 200, % x100)
                           %QW101  actual_pos          (holding reg 201)

  Control: valve fully closed at SETPOINT (25.00 degC), fully open at
  SETPOINT + 5.00 degC, proportional in between.
*)

PROGRAM CoolingControl
  VAR
    Temperature    AT %IW100 : INT;  (* degC x100, e.g. 2537 = 25.37 degC *)
    ValveActualIn  AT %IW102 : INT;  (* actual aperture read from the device *)
    ValveTarget    AT %QW100 : INT;  (* commanded aperture, 0..10000 = 0..100% *)
    ValveActualOut AT %QW101 : INT;  (* echoed back, see note below *)
  END_VAR
  VAR
    Setpoint : INT := 2500;          (* 25.00 degC *)
    Band     : INT := 500;           (* full opening 5.00 degC above setpoint *)
    Delta    : INT;
  END_VAR

  (* Proportional opening, clamped to 0..100% *)
  Delta := Temperature - Setpoint;
  IF Delta < 0 THEN
    Delta := 0;
  ELSIF Delta > Band THEN
    Delta := Band;
  END_IF;

  ValveTarget := Delta * 20;         (* 0..500 -> 0..10000 *)

  (* The write range covers both holding registers of the valve; echo the
     actual position back so we never overwrite it with a stale value. *)
  ValveActualOut := ValveActualIn;

END_PROGRAM

CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#100ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : CoolingControl;
  END_RESOURCE
END_CONFIGURATION
