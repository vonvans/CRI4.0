package proxy

import (
	"context"
	"log/slog"
	"net"
	"sync"

	"github.com/t3labit/netproxy_cri/internal/config"
	"github.com/t3labit/netproxy_cri/internal/interceptor"
	"github.com/t3labit/netproxy_cri/internal/protocols/modbus"
	"github.com/t3labit/netproxy_cri/internal/protocols/rawtcp"
)

// StartTCPListener avvia il server in ascolto per una specifica regola TCP-based
func StartTCPListener(ctx context.Context, wg *sync.WaitGroup, rule config.ProxyRule, logger *slog.Logger) {
	defer wg.Done()

	listener, err := net.Listen("tcp", rule.ListenAddr())
	if err != nil {
		logger.Error("Errore avvio listener TCP", "rule", rule.Name, "err", err)
		return
	}
	defer listener.Close()

	logger.Info("Listener avviato", "rule", rule.Name, "addr", rule.ListenAddr())

	// Graceful shutdown con context.AfterFunc (come avevamo visto prima)
	stop := context.AfterFunc(ctx, func() {
		logger.Info("Chiusura listener in corso...", "rule", rule.Name)
		listener.Close() // Sblocca l'Accept()
	})
	defer stop()

	for {
		clientConn, err := listener.Accept()
		if err != nil {
			if ctx.Err() != nil {
				return // Chiusura voluta tramite Ctrl+C
			}
			logger.Error("Errore accept", "rule", rule.Name, "err", err)
			continue
		}

		// Per ogni nuovo client, avviamo una goroutine che gestisce la connessione
		go handleTCPConn(clientConn, rule, logger)
	}
}

// handleTCPConn applica il routing del protocollo e i plugin
func handleTCPConn(clientConn net.Conn, rule config.ProxyRule, logger *slog.Logger) {
	defer clientConn.Close()

	targetConn, err := net.Dial("tcp", rule.TargetAddr())
	if err != nil {
		logger.Error("Errore dial verso target", "rule", rule.Name, "err", err)
		return
	}
	defer targetConn.Close()

	logger = logger.With(
		"rule", rule.Name,
	    "client", clientConn.RemoteAddr().String(),
	    "proxy_in", clientConn.LocalAddr().String(),
	    "proxy_out", targetConn.LocalAddr().String(),
	    "target", targetConn.RemoteAddr().String(),
	)
	logger.Debug("Connessione instradata")

	// Risoluzione dinamica dei plugin
	var plugins []any
	for _, name := range rule.Interceptors {
		p, err := interceptor.Get(name)
		if err != nil {
			logger.Warn("Plugin non trovato", "name", name)
			continue
		}
		plugins = append(plugins, p)
	}

	var wg sync.WaitGroup

	// --- ROUTER DEI PROTOCOLLI ---
	switch rule.Proto {
	case "modbus":
		// Modbus/TCP Handler
		modbus.Handle(&wg, clientConn, targetConn, plugins, logger)
	case "tcp":
		// Raw TCP Handler
		rawtcp.Handle(&wg, clientConn, targetConn, plugins, logger)
	default:
		logger.Error("Protocollo non supportato a livello TCP", "proto", rule.Proto)
		return
	}

	wg.Wait()
	logger.Debug("Connessione chiusa")
}

