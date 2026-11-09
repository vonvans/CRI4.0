package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/t3labit/netproxy_cri/internal/config"
	"github.com/t3labit/netproxy_cri/internal/proxy"

	// Plugin registration, calling "init" from the module
	_ "github.com/t3labit/netproxy_cri/internal/plugins/dumplogger"
	_ "github.com/t3labit/netproxy_cri/internal/plugins/modbus_logger"
)


func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(logger)

	// Loading configuration
	cfg, err := config.Load("config.json")
	if err != nil {
		logger.Error("Error loading config.json", "err", err)
		os.Exit(1)
	}

	// Graceful shutdown for sigint and sigterm
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	var wg sync.WaitGroup

	// Starting proxies for known protocols
	for _, rule := range cfg.Rules {
		switch rule.Proto {
		case "tcp", "modbus":
			wg.Add(1)
			go proxy.StartTCPListener(ctx, &wg, rule, logger)
		case "udp":
			wg.Add(1)
			go proxy.StartUDPListener(ctx, &wg, rule, logger)
		default:
			logger.Warn("Protocollo non ancora supportato", "rule", rule.Name, "proto", rule.Proto)
		}
	}

	logger.Info("Proxy avviato. Premi Ctrl+C per fermarlo.")
	<-ctx.Done()
	logger.Info("Segnale ricevuto. Attesa terminazione connessioni attive...")
	wg.Wait() 
	logger.Info("Terminated")
}
