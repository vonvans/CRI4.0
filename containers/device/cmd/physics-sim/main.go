package main

import (
	"context"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/t3labit/cri40-scenario-tools/internal/config"
	"github.com/t3labit/cri40-scenario-tools/internal/gateway"
	"github.com/t3labit/cri40-scenario-tools/internal/netstream"
	"github.com/t3labit/cri40-scenario-tools/internal/physics"
	"github.com/t3labit/cri40-scenario-tools/internal/webstream"
)

type AppConfig struct {
	SimConfigPath string `flag:"sim-cfg" env:"SIM_CFG" default:"simulation.json"`
	NetConfigPath string `flag:"net-cfg" env:"NET_CFG" default:"gateway.json"`
	VisConfigPath string `flag:"vis-cfg" env:"VIS_CFG" default:"visualization.json"`
	// pub/sub protocol
	BindIP        string `flag:"bind-ip" env:"BIND_IP" default:"0.0.0.0"`
	BindPort      string `flag:"bind-port" env:"BIND_PORT" default:"8082"`
	// web UI
	WebBindPort   string `flag:"web-port" env:"WEB_PORT" default:"8080"`
}

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	var appCfg AppConfig
	_ = config.LoadDefaults(&appCfg)
	_ = config.LoadEnv(&appCfg)
	_ = config.LoadFlags(&appCfg)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	slog.Info("Avvio del Motore Fisico Core...")

	simCfg, err := config.LoadSimulationConfig(appCfg.SimConfigPath)
	if err != nil {
		slog.Error("Errore critico caricamento simulation.json", "error", err)
		os.Exit(1)
	}

	visCfgBytes, err := os.ReadFile(appCfg.VisConfigPath)
    if err != nil {
        slog.Error("Errore critico caricamento visualization.json", "error", err)
        os.Exit(1)
    }

	netCfg, err := config.LoadGatewayConfig(appCfg.NetConfigPath)
	if err != nil {
		slog.Error("Errore critico caricamento gateway.json", "error", err)
		os.Exit(1)
	}

	engine, err := physics.NewEngine(simCfg)
	if err != nil {
		slog.Error("Errore compilazione grafo fisico nell'Engine", "error", err)
		os.Exit(1)
	}

	// Il costruttore del gateway torna a essere snello e autonomo
	gw, err := gateway.NewGateway(netCfg, engine)
	if err != nil {
		slog.Error("Errore inizializzazione Gateway di rete", "error", err)
		os.Exit(1)
	}

	srv := netstream.NewServer()
	gw.StartSubscriptions(srv)

	webSrv := webstream.NewServer(engine, visCfgBytes)

	var wg sync.WaitGroup

	// Pub/Sub protocol handled here
	bindAddr := net.JoinHostPort(appCfg.BindIP, appCfg.BindPort)
	wg.Go(func() {
		slog.Info("Server unico di simulazione netstream in avvio...", "indirizzo", bindAddr)
		if err := srv.Start(ctx, bindAddr); err != nil {
			slog.Error("Server netstream interrotto per un errore critico", "error", err)
		}
	})

	// This handles the web UI
	webAddr := net.JoinHostPort(appCfg.BindIP, appCfg.WebBindPort)
	wg.Go(func() {
		slog.Info("Interfaccia grafica Web HMI in avvio offline...", "indirizzo", "http://localhost:"+appCfg.WebBindPort)
		if err := webSrv.Start(ctx, webAddr); err != nil {
			slog.Error("Server Web interrotto per un errore critico", "error", err)
		}
	})

	// This handles the physics simulation
	wg.Go(func() {
		dt := time.Duration(simCfg.Simulation.DtSeconds * float64(time.Second))
		ticker := time.NewTicker(dt)
		defer ticker.Stop()

		slog.Info("Simulatore Fisico e Gateway pronti e sincronizzati.", "passo_calcolo", dt)

		for {
			select {
			case <-ctx.Done():
				slog.Warn("Intercettato segnale di arresto. Spegnimento simulatore...")
				return
			case <-ticker.C:
				// FASE A: Sincronizzazione dei comandi in ingresso (Mailbox -> RAM Engine)
				gw.FlushInbound()

				// FASE B: Calcolo e avanzamento dell'universo fisico
				engine.Progress()

				// FASE C: Aggiornamento immediato dello snapshot per i client di rete connessi
				gw.UpdateTelemetry()
			}
		}
	})

	<-ctx.Done()
	slog.Info("Stop received, shutting down...");

	wg.Wait()
	slog.Info("Shutdown done");
}
