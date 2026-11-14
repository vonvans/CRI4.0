package gateway

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/t3labit/cri40-scenario-tools/internal/config"
	"github.com/t3labit/cri40-scenario-tools/internal/netstream"
	"github.com/t3labit/cri40-scenario-tools/internal/physics"
	"github.com/t3labit/cri40-scenario-tools/internal/protocol"
)

type InboundMailbox struct {
	mu    sync.Mutex
	value float64
	dirty bool
}

type InboundLink struct {
	mailbox *InboundMailbox
	target  *float64
}

type OutboundLink struct {
	topic    string
	source   *float64 // Punta a .Current dell'Engine
	interval time.Duration
	
	// Gestione dello snapshot thread-safe isolato
	mu       sync.Mutex
	value    float64 
}

type Gateway struct {
	engine        *physics.Engine
	inboundLinks  []InboundLink
	outboundLinks []OutboundLink
	mailboxes     map[string]*InboundMailbox
}

// NewGateway non ha più bisogno di contesti o IP remoti, lavora solo in ascolto locale
func NewGateway(netCfg *config.GatewayConfig, eng *physics.Engine) (*Gateway, error) {
	gw := &Gateway{
		engine:        eng,
		inboundLinks:  make([]InboundLink, 0),
		outboundLinks: make([]OutboundLink, 0),
		mailboxes:     make(map[string]*InboundMailbox),
	}

	// 1. CONFIGURAZIONE INBOUND (PUB esterni -> Server nostro)
	for _, pMap := range netCfg.NetworkMapping.Publishers {
		comp, exists := eng.GetComponent(pMap.TargetComponent)
		if !exists {
			return nil, fmt.Errorf("gateway: componente '%s' inesistente", pMap.TargetComponent)
		}

		inputPtr, err := comp.BindInput(pMap.TargetPort)
		if err != nil {
			return nil, fmt.Errorf("gateway: errore binding input %s.%s: %w", pMap.TargetComponent, pMap.TargetPort, err)
		}

		box := &InboundMailbox{}
		gw.mailboxes[pMap.Topic] = box

		gw.inboundLinks = append(gw.inboundLinks, InboundLink{
			mailbox: box,
			target:  inputPtr,
		})
		slog.Info("Mappato canale INBOUND (Rete -> Engine)", "topic", pMap.Topic, "target", pMap.TargetComponent+"."+pMap.TargetPort)
	}

	// 2. CONFIGURAZIONE OUTBOUND (Server nostro -> SUB esterni)
	for _, sMap := range netCfg.NetworkMapping.Subscribers {
		comp, exists := eng.GetComponent(sMap.SourceComponent)
		if !exists {
			return nil, fmt.Errorf("gateway: componente '%s' inesistente", sMap.SourceComponent)
		}

		outputPtr, err := comp.BindOutput(sMap.SourcePort)
		if err != nil {
			return nil, fmt.Errorf("gateway: errore binding output %s.%s: %w", sMap.SourceComponent, sMap.SourcePort, err)
		}

		gw.outboundLinks = append(gw.outboundLinks, OutboundLink{
			topic:    sMap.Topic,
			source:   outputPtr,
			interval: time.Duration(sMap.IntervalMs) * time.Millisecond,
		})
		slog.Info("Mappato canale OUTBOUND (Server -> Client SUB)", "topic", sMap.Topic, "sorgente", sMap.SourceComponent+"."+sMap.SourcePort, "frequenza_ms", sMap.IntervalMs)
	}

	return gw, nil
}

// StartSubscriptions registra sia i lettori che i produttori sul server netstream unico
func (gw *Gateway) StartSubscriptions(srv *netstream.Server) {
	// Gestione dei comandi in ingresso (PUB)
	for topic, box := range gw.mailboxes {
		currentBox := box
		netstream.RegisterPubHandler(srv, topic, func(ctx context.Context, msg protocol.FloatSignal) {
			currentBox.mu.Lock()
			currentBox.value = msg.Value
			currentBox.dirty = true
			currentBox.mu.Unlock()
		})
	}

	// Gestione della telemetria in uscita (SUB)
	// Sfrutta il RegisterSubHandler del server: se nessun client è connesso, 
	// questa funzione non viene mai eseguita. Zero sprechi.
	for i := range gw.outboundLinks {
		currentLink := &gw.outboundLinks[i]
		
		netstream.RegisterSubHandler(srv, currentLink.topic, currentLink.interval, func(ctx context.Context) protocol.FloatSignal {
			currentLink.mu.Lock()
			val := currentLink.value
			currentLink.mu.Unlock()
			return protocol.FloatSignal{Value: val}
		})
	}
}

func (gw *Gateway) FlushInbound() {
	for _, link := range gw.inboundLinks {
		link.mailbox.mu.Lock()
		if link.mailbox.dirty {
			*link.target = link.mailbox.value
			link.mailbox.dirty = false
		}
		link.mailbox.mu.Unlock()
	}
}

// UpdateTelemetry aggiorna lo snapshot locale a costo zero alla fine di ogni Tick fisco.
// Sostituisce la vecchia PublishTelemetry che controllava i timer e gestiva le code.
func (gw *Gateway) UpdateTelemetry() {
	for i := range gw.outboundLinks {
		link := &gw.outboundLinks[i]
		link.mu.Lock()
		// Copia diretta da RAM a RAM del valore consolidato dell'Engine
		link.value = *link.source
		link.mu.Unlock()
	}
}
