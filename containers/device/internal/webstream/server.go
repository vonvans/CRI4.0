package webstream

import (
	"context"
	"embed"
	"encoding/json"
	"io/fs"
	"log/slog"
	"math"
	"net"
	"mime"
	"net/http"
	"time"

	"github.com/t3labit/cri40-scenario-tools/internal/physics"
)

//go:embed public/*
var embeddedFS embed.FS

type Server struct {
	engine   *physics.Engine
	staticFS fs.FS
	visualConfBytes []byte
}

// NewServer ora non ha più bisogno che gli venga passato il file system dall'esterno!
func NewServer(eng *physics.Engine, visConfBytes []byte) *Server {
	// Estraiamo la sotto-vista "public" direttamente qui all'inizializzazione
	subFS, err := fs.Sub(embeddedFS, "public")
	if err != nil {
		panic("webstream: errore critico nell'estrazione dell'embed locale: " + err.Error())
	}

	return &Server{
		engine:   eng,
		staticFS: subFS,
		visualConfBytes: visConfBytes,
	}
}

// Start avvia il server HTTP bloccante. Verrà eseguito nella WaitGroup del main.go
func (s *Server) Start(ctx context.Context, listenAddr string) error {
	_ = mime.AddExtensionType(".js", "application/javascript; charset=utf-8")
	mux := http.NewServeMux()

	// 1. ENDPOINT TOPOLOGIA: Restituisce l'intero JSON strutturale statico (Chiamato 1 volta a startup dal browser)
	mux.HandleFunc("GET /api/topology", s.handleTopology)
	// Get the visualization config
	mux.HandleFunc("GET /api/visualization", s.handleVisualization)
	// 2. ENDPOINT TELEMETRIA SSE: Stream continuo in push nativo senza dipendenze da WebSocket
	mux.HandleFunc("GET /stream", s.handleSSEStream)

	// 3. FILE SERVER STATICO: Distribuisce index.html, app.js e Three.js interamente dalla memoria RAM
	mux.Handle("GET /", http.FileServer(http.FS(s.staticFS)))

	srv := &http.Server{
		Addr:        listenAddr,
		Handler:     mux,
		BaseContext: func(_ net.Listener) context.Context { return ctx },
	}

	// Goroutine sentinella per spegnere il server HTTP quando il contesto generale si cancella
	go func() {
		<-ctx.Done()
		slog.Info("Shutting down the Server Web...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	return srv.ListenAndServe()
}

func (s *Server) handleTopology(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	cfg := s.engine.GetTopology()
	_ = json.NewEncoder(w).Encode(cfg)
}

// sanitizeSnapshot sostituisce i valori non-finiti (NaN/±Inf) con 0, così lo
// snapshot resta sempre serializzabile in JSON (vedi handleSSEStream).
func sanitizeSnapshot(snapshot map[string]physics.RuntimeSnapshot) {
	for comp, state := range snapshot {
		for k, v := range state.Inputs {
			if math.IsNaN(v) || math.IsInf(v, 0) {
				state.Inputs[k] = 0
			}
		}
		for k, v := range state.Outputs {
			if math.IsNaN(v) || math.IsInf(v, 0) {
				state.Outputs[k] = 0
			}
		}
		snapshot[comp] = state
	}
}

func (s *Server) handleVisualization(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(s.visualConfBytes)
}

func (s *Server) handleSSEStream(w http.ResponseWriter, r *http.Request) {
	// Verifichiamo che la response supporti lo sblocco immediato del buffer (Streaming continuo)
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Lo streaming SSE non è supportato dal server", http.StatusInternalServerError)
		return
	}

	// Configurazione degli Header standard per i Server-Sent Events nativi
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Frequenza di campionamento visivo impostata a ~30 FPS (33 millisecondi)
	ticker := time.NewTicker(33 * time.Millisecond)
	defer ticker.Stop()

	slog.Info("Nuovo browser connesso alla dashboard visiva", "ip_client", r.RemoteAddr)

	for {
		select {
		case <-r.Context().Done():
			slog.Warn("Il browser ha chiuso la scheda della dashboard", "ip_client", r.RemoteAddr)
			return
		case <-ticker.C:
			// Estraiamo la fotografia istantanea totale delle variabili in RAM dall'Engine
			snapshot := s.engine.GetRuntimeSnapshot()

			// json.Marshal fallisce (e lo stream resterebbe muto) se un valore è
			// NaN/±Inf (es. una costante di tempo del sensore più piccola del
			// passo di integrazione). Sanitizziamo i non-finiti per non lasciare
			// la dashboard su "Waiting for data...".
			sanitizeSnapshot(snapshot)

			// Serializziamo in formato JSON compatto
			payload, err := json.Marshal(snapshot)
			if err != nil {
				continue
			}

			// Il protocollo SSE impone tassativamente il prefisso "data: " e la doppia terminazione "\n\n"
			if _, err := w.Write([]byte("data: " + string(payload) + "\n\n")); err != nil {
				return // Se la socket si è rotta, usciamo dal ciclo per liberare la goroutine
			}

			// Forza la spedizione immediata dei byte sulla rete senza accumularli nei buffer intermedi
			flusher.Flush()
		}
	}
}
