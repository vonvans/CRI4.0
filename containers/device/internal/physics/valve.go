package physics

import (
	"math"
	"github.com/t3labit/cri40-scenario-tools/internal/config"
)

type MechanicalValve struct {
	id string

	// PROPRIETÀ
	RateLimit float64 `physics:"property,physical_rate_limit,%/s"`

	// INGRESSI (1-a-1, mappato come float64 diretto)
	TargetPosition float64 `physics:"input,target_position,%"`

	// USCITE (Double-buffered)
	ActualAperture DoubleBuffer `physics:"output,actual_aperture,%"`
}

func init() {
	RegisterComponentType("mechanical_valve", func(id string, props map[string]config.Property, capacities map[string]int) (Component, error) {
		v := &MechanicalValve{id: id}
		if err := AutoConfigure(v, props, capacities); err != nil {
			return nil, err
		}
		return v, nil
	})
}

func (v *MechanicalValve) ID() string   { return v.id }
func (v *MechanicalValve) Type() string { return "mechanical_valve" }

func (v *MechanicalValve) Inputs() map[string]config.InternalUnit  { return BuildPortMetadata(v, "input") }
func (v *MechanicalValve) Outputs() map[string]config.InternalUnit { return BuildPortMetadata(v, "output") }
func (v *MechanicalValve) BindInput(port string) (*float64, error) { return AutoBindInput(v, port) }
func (v *MechanicalValve) BindOutput(port string) (*float64, error) { return AutoBindOutput(v, port) }

func (v *MechanicalValve) Tick(dt float64) {
	diff := v.TargetPosition - v.ActualAperture.Current
	nextAperture := v.ActualAperture.Current

	if diff != 0 {
		maxStep := v.RateLimit * dt
		if math.Abs(diff) > maxStep {
			if diff > 0 {
				nextAperture += maxStep
			} else {
				nextAperture -= maxStep
			}
		} else {
			nextAperture = v.TargetPosition
		}
	}

	v.ActualAperture.Next = nextAperture
}

func (v *MechanicalValve) Commit() {
	v.ActualAperture.Commit()
}
