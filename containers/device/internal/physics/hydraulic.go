package physics

import (
	"math"
	"github.com/t3labit/cri40-scenario-tools/internal/config"
)

type HydraulicLine struct {
	id string

	// PROPRIETÀ
	UpstreamPressure float64 `physics:"property,upstream_pressure,bar"`
	FlowCoefficient  float64 `physics:"property,flow_coefficient,kg/s"` // Portata max a 1 bar

	// INGRESSI
	ValveAperture float64 `physics:"input,valve_aperture,%"`

	// USCITE
	MassFlow DoubleBuffer `physics:"output,mass_flow,kg/s"`
}

func init() {
	RegisterComponentType("hydraulic_line", func(id string, props map[string]config.Property, capacities map[string]int) (Component, error) {
		h := &HydraulicLine{id: id}
		if err := AutoConfigure(h, props, capacities); err != nil {
			return nil, err
		}
		return h, nil
	})
}

func (h *HydraulicLine) ID() string   { return h.id }
func (h *HydraulicLine) Type() string { return "hydraulic_line" }

func (h *HydraulicLine) Inputs() map[string]config.InternalUnit  { return BuildPortMetadata(h, "input") }
func (h *HydraulicLine) Outputs() map[string]config.InternalUnit { return BuildPortMetadata(h, "output") }
func (h *HydraulicLine) BindInput(port string) (*float64, error) { return AutoBindInput(h, port) }
func (h *HydraulicLine) BindOutput(port string) (*float64, error) { return AutoBindOutput(h, port) }

func (h *HydraulicLine) Tick(dt float64) {
	// Assumiamo che la pressione a valle (dentro il reattore) sia atmosferica (~1.0 bar)
	deltaP := h.UpstreamPressure - 1.0
	if deltaP < 0 {
		deltaP = 0
	}

	// Equazione della portata: Q = Cv * (Apertura/100) * sqrt(DeltaP)
	apertureRatio := h.ValveAperture / 100.0
	h.MassFlow.Next = h.FlowCoefficient * apertureRatio * math.Sqrt(deltaP)
}

func (h *HydraulicLine) Commit() {
	h.MassFlow.Commit()
}
