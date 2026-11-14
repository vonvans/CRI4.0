package peripheral

import (
	"fmt"
	"time"
)

// VariableCtx è l'interfaccia thread-safe passata ai driver per manipolare la RAM isolata
type VariableCtx interface {
	Get(name string) float64
	Set(name string, value float64)
	GetProperty(name string) float64
}

// DeviceDriver definisce il comportamento logico puro di un dispositivo di campo
type DeviceDriver interface {
	// Init viene invocata a startup per configurare lo stato iniziale del driver
	Init(ctx VariableCtx) error
	
	// OnVariableWrite viene invocata quando una variabile associata cambia stato (es: comando dal PLC)
	OnVariableWrite(name string, newValue float64, ctx VariableCtx)
	
	// OnTick viene invocata periodicamente per i driver che richiedono cicli cinematici o temporali
	// Ritorna la durata del periodo di tick (se <= 0, il ticker per questo driver viene disattivato)
	TickInterval() time.Duration
	OnTick(dt float64, ctx VariableCtx)
}

// DriverFactory è la firma della funzione per istanziare dinamicamente un determinato driver
type DriverFactory func() DeviceDriver

// Registro centrale statico delle fabbriche dei driver
var driverRegistry = make(map[string]DriverFactory)

// RegisterDriver permette ai pacchetti specifici di censire i propri algoritmi a startup
func RegisterDriver(deviceType string, factory DriverFactory) {
	driverRegistry[deviceType] = factory
}

// NewDriverInstance cerca nel registro e istanzia il driver corretto in base al nome configurato
func NewDriverInstance(deviceType string) (DeviceDriver, error) {
	factory, exists := driverRegistry[deviceType]
	if !exists {
		return nil, fmt.Errorf("peripheral: driver per il tipo '%s' non registrato nel framework", deviceType)
	}
	return factory(), nil
}
