package peripheral

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/t3labit/cri40-scenario-tools/internal/netstream"
	"github.com/t3labit/cri40-scenario-tools/internal/protocol"
)

// Definiamo il tipo di dato float nativo richiesto dal protocol/messages.go
type netstreamPayload = protocol.FloatSignal

type NetstreamManager struct {
	cfg         *Config
	space       *VariableSpace
	pubTopics   map[string]string // Mappa: nome_variabile -> nome_topic
	subTopics   map[string]string // Mappa: nome_topic -> nome_variabile
	publishers  map[string]*netstream.Publisher[netstreamPayload]
	subscribers map[string]*netstream.Subscriber[netstreamPayload]
}

// NewNetstreamManager mappa la topologia del JSON per capire chi va in PUB e chi in SUB
func NewNetstreamManager(cfg *Config, space *VariableSpace) *NetstreamManager {
	nm := &NetstreamManager{
		cfg:         cfg,
		space:       space,
		pubTopics:   make(map[string]string),
		subTopics:   make(map[string]string),
		publishers:  make(map[string]*netstream.Publisher[netstreamPayload]),
		subscribers: make(map[string]*netstream.Subscriber[netstreamPayload]),
	}

	for varName, varCfg := range cfg.Variables {
		if varCfg.NetstreamPub != "" {
			nm.pubTopics[varName] = varCfg.NetstreamPub
		}
		if varCfg.NetstreamSub != "" {
			nm.subTopics[varCfg.NetstreamSub] = varName
		}
	}

	return nm
}

// Connect esegue le connessioni reali e gli handshake a startup (1 sola socket per canale).
// Se il simulatore fisico è spento, fallisce istantaneamente e blocca il boot della periferica.
func (nm *NetstreamManager) Connect(ctx context.Context) error {
	// 1. Inizializzazione sincrona di tutti i canali di trasmissione (PUB)
	for varName, topic := range nm.pubTopics {
		pub, err := netstream.NewPublisher[netstreamPayload](ctx, nm.cfg.NetstreamAddr, topic)
		if err != nil {
			return fmt.Errorf("netstream_manager: fallito handshake di boot in PUB per [%s] sul topic '%s': %w", varName, topic, err)
		}
		nm.publishers[varName] = pub
		slog.Info("Canale Netstream PUB connesso e pronto", "device", nm.cfg.DeviceType, "variabile", varName, "topic", topic)
	}

	// 2. Inizializzazione sincrona di tutti i canali di ricezione (SUB)
	for topic, varName := range nm.subTopics {
		sub, err := netstream.NewSubscriber[netstreamPayload](ctx, nm.cfg.NetstreamAddr, topic)
		if err != nil {
			return fmt.Errorf("netstream_manager: fallito handshake di boot in SUB per [%s] sul topic '%s': %w", varName, topic, err)
		}
		nm.subscribers[topic] = sub
		slog.Info("Canale Netstream SUB connesso e pronto", "device", nm.cfg.DeviceType, "variabile", varName, "topic", topic)
	}

	return nil
}

// HandleRuntimePublish riceve le modifiche dallo VariableSpace e le inoltra alla coda del Publisher
func (nm *NetstreamManager) HandleRuntimePublish(name string, value float64) {
	pub, exists := nm.publishers[name]
	if !exists {
		return // Questa variabile non deve essere trasmessa alla fisica
	}

	// Impacchettiamo il float64 puro nella struct FloatSignal ereditata da protocol/messages.go
	pub.Publish(netstreamPayload{
		Value: value,
	})
}

// StartInboundLoops consuma le socket dei subscriber già connesse e lancia l'ascolto asincrono
func (nm *NetstreamManager) StartInboundLoops(ctx context.Context, wg *sync.WaitGroup) {
	for topic, varName := range nm.subTopics {
		t := topic
		v := varName
		sub := nm.subscribers[t]

		// Usiamo il wrapper wg.Go() nativo per integrarsi simmetricamente nel ciclo vitale del software
		wg.Go(func() {
			slog.Info("Ascolto asincrono Netstream SUB avviato", "topic", t, "variabile_target", v)

			// Fa partire l'ascolto sulla socket aperta a startup.
			// Se la connessione cade a runtime, il metodo gestirà i retry internamente.
			err := sub.Listen(ctx, func(handlerCtx context.Context, msg netstreamPayload) {
				// Ricezione reattiva: aggiorniamo la RAM dello spazio variabili
				nm.space.Set(v, msg.Value)
			})

			if err != nil {
				slog.Error("Canale Netstream SUB terminato per errore critico", "topic", t, "error", err)
			}
		})
	}
}

// ForceInitialPublish prende i valori correnti presenti nello VariableSpace
// a fine inizializzazione e li spara sulla rete per allineare il simulatore fisico.
func (nm *NetstreamManager) ForceInitialPublish() {
	for varName := range nm.pubTopics {
		val := nm.space.Get(varName)
		
		// Controllo di sicurezza difensivo per evitare panici da puntatore nullo
		if pub, exists := nm.publishers[varName]; exists && pub != nil {
			pub.Publish(netstreamPayload{
				Value: val,
			})
			slog.Info("Allineamento di boot inviato alla fisica", "variabile", varName, "valore", val)
		}
	}
}
