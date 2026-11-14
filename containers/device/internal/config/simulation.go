package config

import (
	"encoding/json"
	"fmt"
	"os"
)

// ============================================================================
// 1. GESTIONE OTTIMIZZATA DELLE UNITÀ DI MISURA (ENUM INTERNI)
// ============================================================================

// Unit rappresenta l'unità di misura fortemente tipizzata nel sistema
type Unit string

// SimulationConfig è la root del file JSON
type SimulationConfig struct {
	Simulation SimulationDetail `json:"simulation"`
}

// SimulationDetail contiene i dettagli del motore, dell'ambiente e dei blocchi
type SimulationDetail struct {
	DtSeconds      float64              `json:"dt_seconds"`
	Description    string               `json:"description"`
	Environment    EnvironmentConfig    `json:"environment"`
	Components     []ComponentConfig    `json:"components"`
	Connections    []ConnectionConfig   `json:"connections"`
}

// Property mappa il singolo valore accoppiato alla sua unità di misura
type Property struct {
	Value float64 `json:"value"`
	Unit  Unit    `json:"unit"`
}

// EnvironmentConfig definisce le proprietà del blocco ambiente speciale ($env)
type EnvironmentConfig struct {
	ID         string              `json:"id"` // Sarà "$env"
	Properties map[string]Property `json:"properties"`
}

// ComponentConfig mappa un oggetto fisico generico dell'impianto
type ComponentConfig struct {
	ID         string              `json:"id"`   // Es: "reactor_core"
	Type       string              `json:"type"` // Es: "thermal_tank"
	Properties map[string]Property `json:"properties"`
}

// PortReference identifica univocamente una determinata porta di un componente
type PortReference struct {
	Component string `json:"component"` // ID del componente (o "$env")
	Port      string `json:"port"`      // Nome della porta di I/O
}

// ConnectionConfig mappa un cablaggio virtuale orientato 1-a-1 tra due porte
type ConnectionConfig struct {
	From PortReference `json:"from"`
	To   PortReference `json:"to"`
}


type InternalUnit int

const (
	UnitUnknown InternalUnit = iota
	UnitCelsius
	UnitBar
	UnitPercentage
	UnitVolt
	UnitKgPerSec
	UnitWatt // Unità base per la potenza (elettrica o termica)
	UnitCount
	UnitJoulesPerK  // Per la capacità termica (ThermalCapacity)
	UnitWattsPerK   // Per il coefficiente di scambio termico (UA)
	UnitPercentSec  // Per lo slew rate della valvola (RateLimit)
	UnitSeconds     // Per la costante di tempo del sensore (Tau)
)

// ParseUnit esegue il parsing della stringa del JSON nell'enum interno.
func ParseUnit(u string) (InternalUnit, error) {
	switch u {
	case "°C":
		return UnitCelsius, nil
	case "bar":
		return UnitBar, nil
	case "%":
		return UnitPercentage, nil
	case "V":
		return UnitVolt, nil
	case "kg/s":
		return UnitKgPerSec, nil
	case "W", "kW":
		// Entrambi mappano all'unità base UnitWatt.
		// La distinzione di scala viene risolta dal metodo Normalize() della proprietà.
		return UnitWatt, nil
	case "count":
		return UnitCount, nil
	case "J/K":
		return UnitJoulesPerK, nil
	case "W/K":
		return UnitWattsPerK, nil
	case "%/s":
		return UnitPercentSec, nil
	case "seconds":
		return UnitSeconds, nil
	default:
		return UnitUnknown, fmt.Errorf("unità di misura sconosciuta o non supportata: %s", u)
	}
}

// GetNormalizedValue restituisce il valore convertito nell'unità base del Sistema Internazionale.
// Risolve elegantemente il problema umano "kW" vs base "W" senza sporcare l'engine.
func (p Property) GetNormalizedValue() float64 {
	switch p.Unit {
	case "kW":
		return p.Value * 1000.0 // 1 kW = 1000 W
	default:
		return p.Value // Già in unità base (es: W, bar, °C)
	}
}

// ============================================================================
// 2. MOTORE DI CARICAMENTO E VALIDAZIONE STRUTTURALE
// ============================================================================

// LoadSimulationConfig si occupa di leggere il file JSON, effettuarne il parsing
// e validare l'intera topologia dell'impianto prima dell'avvio dell'engine.
func LoadSimulationConfig(path string) (*SimulationConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("impossibile leggere il file di configurazione: %w", err)
	}

	var cfg SimulationConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("errore nel parsing del JSON di simulazione: %w", err)
	}

	// Invochiamo il validatore semantico
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("configurazione della simulazione non valida: %w", err)
	}

	return &cfg, nil
}

// Validate analizza la coerenza logica dei dati grezzi caricati dal JSON
func (c *SimulationConfig) Validate() error {
	sim := c.Simulation

	// Controllo preliminare sul tempo di campionamento
	if sim.DtSeconds <= 0 {
		return fmt.Errorf("il parametro 'dt_seconds' deve essere maggiore di zero (valore attuale: %f)", sim.DtSeconds)
	}

	// Mappa per censire gli ID validi ed evitare duplicati
	validIDs := make(map[string]bool)
	
	// Il blocco ambiente ha un ID riservato di sistema e viene pre-censito
	if sim.Environment.ID != "$env" {
		return fmt.Errorf("l'ambiente globale deve avere tassativamente ID '$env' (trovato invece: '%s')", sim.Environment.ID)
	}
	validIDs["$env"] = true

	// Validazione delle proprietà dell'ambiente
	for propName, prop := range sim.Environment.Properties {
		if _, err := ParseUnit(string(prop.Unit)); err != nil {
			return fmt.Errorf("errore nell'ambiente ($env) alla proprietà '%s': %w", propName, err)
		}
	}

	// 1. CONTROLLO E CENSIMENTO DEI COMPONENTI
	for _, comp := range sim.Components {
		if comp.ID == "" {
			return fmt.Errorf("rilevato un componente configurato senza il campo 'id'")
		}
		if comp.ID == "$env" {
			return fmt.Errorf("un componente non può utilizzare l'ID riservato '$env'")
		}
		if validIDs[comp.ID] {
			return fmt.Errorf("rilevato ID componente duplicato nella configurazione: '%s'", comp.ID)
		}
		
		// Registriamo l'ID come valido per i successivi controlli sulle connessioni
		validIDs[comp.ID] = true

		// Validazione delle unità di misura di tutte le proprietà dichiarate nel blocco
		for propName, prop := range comp.Properties {
			if _, err := ParseUnit(string(prop.Unit)); err != nil {
				return fmt.Errorf("componente '%s', errore nella proprietà '%s': %w", comp.ID, propName, err)
			}
		}
	}

	// 2. CONTROLLO DELLE CONNESSONI ORFANE (TOPOLOGIA DEL GRAFO)
	for i, conn := range sim.Connections {
		// Verifica esistenza del componente sorgente
		if !validIDs[conn.From.Component] {
			return fmt.Errorf("connessione [%d]: il componente sorgente '%s' non esiste nella configurazione dell'impianto", i, conn.From.Component)
		}
		// Verifica esistenza del componente destinazione
		if !validIDs[conn.To.Component] {
			return fmt.Errorf("connessione [%d]: il componente destinazione '%s' non esiste nella configurazione dell'impianto", i, conn.To.Component)
		}
		// Cortocircuito di sicurezza
		if conn.From.Component == conn.To.Component && conn.From.Port == conn.To.Port {
			return fmt.Errorf("connessione [%d]: anomalia di loop critico, impossibile collegare una porta a se stessa (%s.%s)", i, conn.From.Component, conn.From.Port)
		}
	}

	return nil
}
