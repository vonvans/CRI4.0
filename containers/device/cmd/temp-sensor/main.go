package main

import (
	"log/slog"
	"time"

	"github.com/t3labit/cri40-scenario-tools/internal/peripheral"
)

// TempSensorDriver implementa l'interfaccia peripheral.DeviceDriver
type TempSensorDriver struct{}

// Init configura lo stato iniziale. Per un sensore puro, non dobbiamo fare nulla.
func (d *TempSensorDriver) Init(ctx peripheral.VariableCtx) error {
	slog.Info("Driver del Sensore di Temperatura inizializzato nello VariableSpace.")
	return nil
}

// OnVariableWrite intercetta l'aggiornamento della variabile.
// Quando Netstream riceve il dato dall'Engine, il framework aggiorna la RAM e invoca questo metodo.
func (d *TempSensorDriver) OnVariableWrite(name string, newValue float64, ctx peripheral.VariableCtx) {
	if name == "reactor_temp" {
		slog.Debug("Temperatura aggiornata dalla fisica", "valore_float", newValue)
	}
}

// TickInterval a 0 disattiva completamente il Ticker per questo driver, 
// consumando zero cicli di CPU in background (funzionamento 100% reattivo a eventi).
func (d *TempSensorDriver) TickInterval() time.Duration {
	return 0
}

// OnTick rimane vuoto perché il sensore non ha una cinematica o comportamenti temporali temporizzati.
func (d *TempSensorDriver) OnTick(dt float64, ctx peripheral.VariableCtx) {}

func main() {
	// 1. Registriamo la factory nel framework associandola alla stringa usata nel JSON
	peripheral.RegisterDriver("TempSensor", func() peripheral.DeviceDriver {
		return &TempSensorDriver{}
	})

	// 2. Lanciamo l'esecuzione automatica.
	// Pensa a tutto il Bootstrap: parsing di --config, allocazione RAM, dial a Netstream,
	// avvio server Modbus TCP su porta 1502 e gestione dello shutdown pulito.
	peripheral.BootstrapAndExecute()
}
