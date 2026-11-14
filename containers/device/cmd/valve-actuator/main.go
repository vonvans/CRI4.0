package main

import (
	"log/slog"
	"math"
	"time"

	"github.com/t3labit/cri40-scenario-tools/internal/peripheral"
)

// ValveActuatorDriver implementa l'interfaccia peripheral.DeviceDriver
type ValveActuatorDriver struct {
	rateLimit  float64
	dtProperty float64
	tickPeriod time.Duration
}

// Init estrae i parametri originali dal contesto di configurazione del JSON
func (d *ValveActuatorDriver) Init(ctx peripheral.VariableCtx) error {
	d.rateLimit = ctx.GetProperty("rate_limit")
	d.dtProperty = ctx.GetProperty("dt")
	
	// Convertiamo il dt float (es: 0.05) nella durata temporale nativa per il Ticker (50ms)
	d.tickPeriod = time.Duration(d.dtProperty * float64(time.Second))

	slog.Info("Driver Valvola Cinematico agganciato", "rate", d.rateLimit, "dt", d.dtProperty)
	return nil
}

// OnVariableWrite intercetta le modifiche autorizzate sulla RAM (Scritture validate dal PLC)
func (d *ValveActuatorDriver) OnVariableWrite(name string, newValue float64, ctx peripheral.VariableCtx) {
	if name == "target_pos" {
		slog.Info("Nuovo TARGET Modbus registrato dal PLC", "target_%", newValue)
	}
}

// Restituisce la durata dinamica estratta dalla configurazione JSON (ActuatorDt)
func (d *ValveActuatorDriver) TickInterval() time.Duration {
	return d.tickPeriod
}

// OnTick esegue l'esatto loop cinematico originale con delta temporale coerente
func (d *ValveActuatorDriver) OnTick(dt float64, ctx peripheral.VariableCtx) {
	target := ctx.Get("target_pos")
	actual := ctx.Get("actual_pos")

	diff := target - actual
	if diff != 0 {
		// Usiamo il d.dtProperty originale per preservare l'esatta precisione del passo di calcolo
		maxStep := d.rateLimit * d.dtProperty
		
		if math.Abs(diff) > maxStep {
			if diff > 0 {
				actual += maxStep
			} else {
				actual -= maxStep
			}
		} else {
			actual = target
		}

		// L'aggiornamento della variabile RAM scatena in automatico il push binario FloatSignal 
		// sul topic "commands/valve/opening" e aggiorna il registro 201 per il read-back del PLC
		slog.Info("Following target ", "target_%", target, "new_actual_%", actual)
		ctx.Set("actual_pos", actual)
	}
}

func main() {
	// Registrazione nel framework
	peripheral.RegisterDriver("ValveActuator", func() peripheral.DeviceDriver {
		return &ValveActuatorDriver{}
	})

	// Esecuzione del ciclo automatizzato (Iniezione configurazione, avvio server e loop)
	peripheral.BootstrapAndExecute()
}

