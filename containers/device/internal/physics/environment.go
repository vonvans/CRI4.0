package physics

import (
	"github.com/t3labit/cri40-scenario-tools/internal/config"
)

type Environment struct {
	id string

	// 1. PROPRIETÀ (Configurate automaticamente)
	ThermalCapacity float64 `physics:"property,thermal_capacity,J/K"`

	// 2. INGRESSI (Allocati automaticamente senza frammentazione)
	ThermalLoads *MultiInput `physics:"input,thermal_load,W"`

	// 3. USCITE (Double-buffered automatiche)
	// Nota: se nel JSON inseriamo "initial_ambient_temperature", verrà agganciata a startup
	AmbientTemperature DoubleBuffer `physics:"output,ambient_temperature,°C"`
	AmbientPressure    DoubleBuffer `physics:"output,ambient_pressure,bar"`
}

func init() {
	RegisterComponentType("environment", func(id string, props map[string]config.Property, capacities map[string]int) (Component, error) {
		env := &Environment{id: id}
		
		// L'automazione popola la struct e alloca i MultiInput contigui
		if err := AutoConfigure(env, props, capacities); err != nil {
			return nil, err
		}
		return env, nil
	})
}

func (e *Environment) ID() string   { return e.id }
func (e *Environment) Type() string { return "environment" }

// DELEGA TOTALE ALLA REFLECTION DI STARTUP
func (e *Environment) Inputs() map[string]config.InternalUnit  { return BuildPortMetadata(e, "input") }
func (e *Environment) Outputs() map[string]config.InternalUnit { return BuildPortMetadata(e, "output") }
func (e *Environment) BindInput(port string) (*float64, error) { return AutoBindInput(e, port) }
func (e *Environment) BindOutput(port string) (*float64, error) { return AutoBindOutput(e, port) }

// IL REGIME RIMANE COERENTE E AD ALTE PRESTAZIONI
func (e *Environment) Tick(dt float64) {
	totalHeatWatts := e.ThermalLoads.Sum()

	deltaJoules := totalHeatWatts * dt
	deltaTemperature := deltaJoules / e.ThermalCapacity

	e.AmbientTemperature.Next = e.AmbientTemperature.Current + deltaTemperature
	e.AmbientPressure.Next = e.AmbientPressure.Current
}

func (e *Environment) Commit() {
	e.AmbientTemperature.Commit()
	e.AmbientPressure.Commit()
}
