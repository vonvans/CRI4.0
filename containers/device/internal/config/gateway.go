package config

import (
	"encoding/json"
	"fmt"
	"os"
)

// GatewayConfig rappresenta la root del file JSON 'gateway.json'
type GatewayConfig struct {
	NetworkMapping NetworkMappingConfig `json:"network_mapping"`
}

// NetworkMappingConfig raggruppa le specifiche di routing per flussi inbound e outbound
type NetworkMappingConfig struct {
	Publishers  []PublisherMapping  `json:"publishers"`
	Subscribers []SubscriberMapping `json:"subscribers"`
}

// PublisherMapping associa un topic di rete in ingresso (comandi PLC) a una porta di un componente
type PublisherMapping struct {
	Topic           string `json:"topic"`
	TargetComponent string `json:"target_component"`
	TargetPort      string `json:"target_port"`
}

// SubscriberMapping associa una porta di un componente a un topic di telemetria periodica
type SubscriberMapping struct {
	Topic           string `json:"topic"`
	IntervalMs      int    `json:"interval_ms"`
	SourceComponent string `json:"source_component"`
	SourcePort      string `json:"source_port"`
}

// LoadGatewayConfig si occupa di leggere il file gateway.json, effettuarne il parsing
// e validarne la coerenza strutturale prima di passarlo al Gateway di rete.
func LoadGatewayConfig(path string) (*GatewayConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("impossibile leggere il file di configurazione gateway: %w", err)
	}

	var cfg GatewayConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("errore nel parsing del JSON del gateway: %w", err)
	}

	// Invochiamo il validatore semantico della rete
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("configurazione del gateway non valida: %w", err)
	}

	return &cfg, nil
}

// Validate esegue i controlli di integrità logica sulle rotte di rete dichiarate
func (g *GatewayConfig) Validate() error {
	mapping := g.NetworkMapping

	// 1. Validazione dei flussi in ingresso (Publishers)
	for i, pub := range mapping.Publishers {
		if pub.Topic == "" {
			return fmt.Errorf("gateway config: publisher [%d] ha il campo 'topic' vuoto", i)
		}
		if pub.TargetComponent == "" || pub.TargetPort == "" {
			return fmt.Errorf("gateway config: publisher [%d] sul topic '%s' non specifica correttamente il componente o la porta di destinazione", i, pub.Topic)
		}
	}

	// 2. Validazione dei flussi in uscita (Subscribers)
	for i, sub := range mapping.Subscribers {
		if sub.Topic == "" {
			return fmt.Errorf("gateway config: subscriber [%d] ha il campo 'topic' vuoto", i)
		}
		if sub.SourceComponent == "" || sub.SourcePort == "" {
			return fmt.Errorf("gateway config: subscriber [%d] sul topic '%s' non specifica correttamente il componente o la porta sorgente", i, sub.Topic)
		}
		// Controllo sulla frequenza di campionamento della telemetria
		if sub.IntervalMs <= 0 {
			return fmt.Errorf("gateway config: subscriber [%d] sul topic '%s' richiede un intervallo non valido (%d ms). Deve essere maggiore di zero", i, sub.Topic, sub.IntervalMs)
		}
	}

	return nil
}
