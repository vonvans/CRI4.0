package config

import (
	"encoding/json"
	"fmt"
	"os"
)

type Config struct {
	Rules []ProxyRule `json:"rules"`
}

type ProxyRule struct {
	Name         string   `json:"name"`
	Proto        string   `json:"proto"`
	InIP         string   `json:"in_ip"`
	InPort       int      `json:"in_port"`
	OutIP        string   `json:"out_ip"`
	OutPort      int      `json:"out_port"`
	UDPTimeoutSec      int      `json:"udp_timeout_sec"`
	Interceptors []string `json:"interceptors"` // Nomi dei plugin da caricare
}

func (r ProxyRule) ListenAddr() string {
	return fmt.Sprintf("%s:%d", r.InIP, r.InPort)
}

func (r ProxyRule) TargetAddr() string {
	return fmt.Sprintf("%s:%d", r.OutIP, r.OutPort)
}

func Load(path string) (*Config, error) {
	configFile, err := os.ReadFile("config.json")
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := json.Unmarshal(configFile, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
