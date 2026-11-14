package physics

import (
	"github.com/t3labit/cri40-scenario-tools/internal/config"
)

type ThermalTank struct {
	id string

	// PROPRIETÀ
	HeatingPower    float64 `physics:"property,heating_power,W"`
	ThermalCapacity float64 `physics:"property,thermal_capacity,J/K"`
	UA              float64 `physics:"property,heat_transfer_coefficient,W/K"` // Coefficiente di scambio con l'esterno

	// INGRESSI
	CoolingFlow        float64 `physics:"input,cooling_flow,kg/s"`
	AmbientTemperature float64 `physics:"input,ambient_temperature,°C"`

	// USCITE
	CoreTemperature DoubleBuffer `physics:"output,core_temperature,°C"`
	ThermalLoss     DoubleBuffer `physics:"output,thermal_loss,W"`
}

func init() {
	RegisterComponentType("thermal_tank", func(id string, props map[string]config.Property, capacities map[string]int) (Component, error) {
		t := &ThermalTank{id: id}
		if err := AutoConfigure(t, props, capacities); err != nil {
			return nil, err
		}
		return t, nil
	})
}

func (t *ThermalTank) ID() string   { return t.id }
func (t *ThermalTank) Type() string { return "thermal_tank" }

func (t *ThermalTank) Inputs() map[string]config.InternalUnit  { return BuildPortMetadata(t, "input") }
func (t *ThermalTank) Outputs() map[string]config.InternalUnit { return BuildPortMetadata(t, "output") }
func (t *ThermalTank) BindInput(port string) (*float64, error) { return AutoBindInput(t, port) }
func (t *ThermalTank) BindOutput(port string) (*float64, error) { return AutoBindOutput(t, port) }

func (t *ThermalTank) Tick(dt float64) {
	currentTemp := t.CoreTemperature.Current

	// 1. Calore generato dalla resistenza elettrica
	qIn := t.HeatingPower

	// 2. Calore rimosso dal refrigerante (ipotizziamo acqua a 15°C in ingresso)
	const coolantInTemp = 15.0
	const cpWater = 4186.0 // J/(kg*K)
	qCooling := t.CoolingFlow * cpWater * (currentTemp - coolantInTemp)

	// 3. Calore dissipato verso la stanza: Q = UA * (T_tank - T_amb)
	qLoss := t.UA * (currentTemp - t.AmbientTemperature)

	// Bilancio energetico netto (Watt = Joules/secondo)
	qNet := qIn - qCooling - qLoss

	// Evoluzione della temperatura: dT = (Q_net * dt) / C_tank
	deltaTemp := (qNet * dt) / t.ThermalCapacity

	t.CoreTemperature.Next = currentTemp + deltaTemp
	t.ThermalLoss.Next = qLoss // Iniettato nel buffer per il blocco $env
}

func (t *ThermalTank) Commit() {
	t.CoreTemperature.Commit()
	t.ThermalLoss.Commit()
}
