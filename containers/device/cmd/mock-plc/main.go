package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/t3labit/cri40-scenario-tools/internal/config"
	"github.com/simonvetter/modbus"
)

// AppConfig mappa gli IP e le porte separati per i due moduli di campo Modbus Slave
type AppConfig struct {
	SensorIP     string `flag:"sensor-ip" env:"MODBUS_SENSOR_IP" default:"localhost"`
	SensorPort   string `flag:"sensor-port" env:"MODBUS_SENSOR_PORT" default:"1502"`
	ActuatorIP   string `flag:"actuator-ip" env:"MODBUS_ACTUATOR_IP" default:"localhost"`
	ActuatorPort string `flag:"actuator-port" env:"MODBUS_ACTUATOR_PORT" default:"1503"`
}

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// 1. CARICAMENTO CONFIGURAZIONE
	var cfg AppConfig
	_ = config.LoadDefaults(&cfg)
	_ = config.LoadEnv(&cfg)
	_ = config.LoadFlags(&cfg)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	slog.Info("Inizializzazione del Mock PLC in Go...")

	// Componiamo gli indirizzi Modbus in modo sicuro
	sensorAddr := net.JoinHostPort(cfg.SensorIP, cfg.SensorPort)
	actuatorAddr := net.JoinHostPort(cfg.ActuatorIP, cfg.ActuatorPort)

	sensorClient, err := modbus.NewClient(&modbus.ClientConfiguration{
		URL:     "tcp://" + sensorAddr, 
		Timeout: 1 * time.Second,
	})
	if err != nil {
		slog.Error("Impossibile configurare il client per il sensore", "error", err)
		os.Exit(1)
	}

	actuatorClient, err := modbus.NewClient(&modbus.ClientConfiguration{
		URL:     "tcp://" + actuatorAddr, 
		Timeout: 1 * time.Second,
	})
	if err != nil {
		slog.Error("Impossibile configurare il client per l'attuatore", "error", err)
		os.Exit(1)
	}

	// Loop di connessione iniziale nel main thread
	connected := false
	for !connected {
		select {
		case <-ctx.Done():
			slog.Info("Avvio del PLC annullato dall'utente.")
			return
		default:
			errS := sensorClient.Open()
			errA := actuatorClient.Open()
			if errS != nil || errA != nil {
				slog.Warn("Moduli di campo non pronti, riprovo tra 2 secondi...", 
					"target_sensor", sensorAddr, "err_sensor", errS, 
					"target_actuator", actuatorAddr, "err_actuator", errA,
				)
				if errS == nil { sensorClient.Close() }
				if errA == nil { actuatorClient.Close() }
				
				select {
				case <-ctx.Done():
					return
				case <-time.After(2 * time.Second):
					continue
				}
			}
			connected = true
		}
	}

	slog.Info("PLC connesso con successo al campo. Avvio del loop di controllo (1Hz)...")

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Warn("Segnale di stop intercettato! Chiusura dei client Modbus...")
			sensorClient.Close()
			actuatorClient.Close()
			slog.Info("Mock PLC arrestato con successo.")
			return

		case <-ticker.C:
			// 1. Lettura dal sensore (FC04, indirizzo 100)
			registers, err := sensorClient.ReadRegisters(100, 1, modbus.INPUT_REGISTER)
			if err != nil {
				slog.Error("Errore durante la lettura del sensore Modbus", "error", err)
				continue
			}

			realTemp := float64(registers[0]) / 100.0

			// 2. Logica di controllo elementare (On/Off a soglia)
			var targetValve uint16 = 0
			if realTemp > 20.0 {
				targetValve = 6000 
			}

			slog.Info("Ciclo di controllo eseguito", 
				"temp_letta", fmt.Sprintf("%.2f°C", realTemp), 
				"azione_valvola", fmt.Sprintf("%.2f%%", float64(targetValve)/100.0),
			)

			// 3. Scrittura sull'attuatore (FC06, indirizzo 200)
			err = actuatorClient.WriteRegister(200, targetValve)
			if err != nil {
				slog.Error("Errore durante la scrittura sull'attuatore Modbus", "error", err)
			}
		}
	}
}
