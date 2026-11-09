package proxy

import (
	"context"
	"log/slog"
	"net"
	"sync"
	"time"

	"github.com/t3labit/netproxy_cri/internal/config"
	"github.com/t3labit/netproxy_cri/internal/interceptor"
	"github.com/t3labit/netproxy_cri/internal/protocols/rawudp"
)

const defaultUDPTimeout = 90 * time.Second

func StartUDPListener(ctx context.Context, wg *sync.WaitGroup, rule config.ProxyRule, logger *slog.Logger) {
	defer wg.Done()

	listenAddr, err := net.ResolveUDPAddr("udp", rule.ListenAddr())
	if err != nil {
		logger.Error("Indirizzo UDP non valido", "rule", rule.Name, "err", err)
		return
	}

	proxyConn, err := net.ListenUDP("udp", listenAddr)
	if err != nil {
		logger.Error("Errore avvio listener UDP", "rule", rule.Name, "err", err)
		return
	}
	defer proxyConn.Close()

	logger.Info("Listener avviato", "rule", rule.Name, "addr", rule.ListenAddr(), "proto", "udp")

	stop := context.AfterFunc(ctx, func() {
		logger.Info("Chiusura listener UDP in corso...", "rule", rule.Name)
		proxyConn.Close()
	})
	defer stop()

	effectiveTimeout := defaultUDPTimeout
	if rule.UDPTimeoutSec > 0 {
		effectiveTimeout = time.Duration(rule.UDPTimeoutSec) * time.Second // Timeout di inattività per chiudere la sessione UDP
		logger.Debug("Custom UDP timeout", "rule", rule.Name, "seconds", rule.UDPTimeoutSec)
	}


	// Tabella NAT: mappa la stringa dell'IP:Port del client a un *net.UDPConn verso il target
	var sessions sync.Map

	// Risoluzione dei plugin
	var plugins []any
	for _, name := range rule.Interceptors {
		if p, err := interceptor.Get(name); err == nil {
			plugins = append(plugins, p)
		} else {
			logger.Warn("Plugin non trovato", "name", name)
		}
	}

	// Buffer per leggere i datagrammi in ingresso (Max UDP size)
	buf := make([]byte, 65535)

	for {
		n, clientAddr, err := proxyConn.ReadFromUDP(buf)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			logger.Error("Errore lettura UDP", "rule", rule.Name, "err", err)
			continue
		}

		// Copiamo i dati per non sovrascrivere il buffer condiviso
		data := make([]byte, n)
		copy(data, buf[:n])

		// Gestiamo il pacchetto in una goroutine per non bloccare il listener
		go handleUDPPacket(data, clientAddr, proxyConn, rule, &sessions, effectiveTimeout, plugins, logger)
	}
}

func handleUDPPacket(data []byte, clientAddr *net.UDPAddr, proxyConn *net.UDPConn, rule config.ProxyRule, sessions *sync.Map, timeout time.Duration, plugins []any, logger *slog.Logger) {
	reqLogger := logger.With(
		"rule", rule.Name,
		"client", clientAddr.String(),
		"target", rule.TargetAddr(),
	)

	// 1. Plugin ispezione Client -> Target
	data, err := rawudp.ProcessPacket(data, true, clientAddr, plugins, reqLogger)
	if err != nil || len(data) == 0 {
		return // Drop
	}

	clientKey := clientAddr.String()
	var targetConn *net.UDPConn

	// 2. Controllo Tabella NAT
	if val, exists := sessions.Load(clientKey); exists {
		targetConn = val.(*net.UDPConn)
	} else {
		// Nuova sessione: apriamo un socket dedicato verso il target
		targetAddr, _ := net.ResolveUDPAddr("udp", rule.TargetAddr())
		targetConn, err = net.DialUDP("udp", nil, targetAddr)
		if err != nil {
			reqLogger.Error("Errore dial UDP verso target", "err", err)
			return
		}

		sessions.Store(clientKey, targetConn)
		reqLogger.Debug("Nuova sessione UDP creata")

		// 3. Goroutine per il traffico Target -> Client
		go func() {
			defer targetConn.Close()
			defer sessions.Delete(clientKey)

			respBuf := make([]byte, 65535)
			for {
				// Fondamentale: se il target non risponde per 60s, chiudiamo tutto per evitare leak
				targetConn.SetReadDeadline(time.Now().Add(timeout))
				n, err := targetConn.Read(respBuf)
				if err != nil {
					reqLogger.Debug("Sessione UDP scaduta o chiusa", "err", err)
					return
				}

				respData := make([]byte, n)
				copy(respData, respBuf[:n])

				// Plugin ispezione Target -> Client
				respData, err = rawudp.ProcessPacket(respData, false, clientAddr, plugins, reqLogger)
				if err != nil || len(respData) == 0 {
					continue
				}

				// Rispediamo al client originale usando il socket principale in ascolto
				proxyConn.WriteToUDP(respData, clientAddr)
			}
		}()
	}

	// 4. Inoltriamo il pacchetto al target
	targetConn.Write(data)
}

