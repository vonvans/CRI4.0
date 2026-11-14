package netstream

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"strings"
	"sync"
	"time"
)

// connectionWorker definisce la closure interna che prenderà in carico il socket
type connectionWorker func(ctx context.Context, conn net.Conn) error

type Server struct {
	pubHandlers map[string]connectionWorker // Gestisce i client che fanno PUB (Inbound)
	subHandlers map[string]connectionWorker // Gestisce i client che fanno SUB (Outbound)
	mu          sync.RWMutex
}

func NewServer() *Server {
	return &Server{
		pubHandlers: make(map[string]connectionWorker),
		subHandlers: make(map[string]connectionWorker),
	}
}

// RegisterPubHandler registra una callback per i flussi in ingresso (PUB).
// La dimensione del buffer viene ricavata automaticamente dal tipo T.
func RegisterPubHandler[T any](s *Server, topic string, handler func(context.Context, T)) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Creiamo un'istanza vuota temporanea di T per interrogarne il tipo
	var dummy T
	
	// Verifichiamo IMMEDIATAMENTE se il puntatore a T implementa l'interfaccia Sizer
	sizer, ok := any(&dummy).(Sizer)
	if !ok {
		return fmt.Errorf("netstream: il tipo %T non implementa netstream.Sizer", &dummy)
	}
	
	// Ricaviamo la dimensione una volta sola all'avvio del server
	messageSize := sizer.Size()

	s.pubHandlers[topic] = func(ctx context.Context, conn net.Conn) error {
		reader := bufio.NewReader(conn)
		// messageSize viene catturato dalla closure circostante, zero overhead a runtime!
		buf := make([]byte, messageSize) 

		for {
			if ctx.Err() != nil {
				return nil
			}

			if _, err := io.ReadFull(reader, buf); err != nil {
				return err 
			}

			var msg T
			// (Il resto della logica di deserializzazione rimane invariata...)
			d, _ := any(&msg).(Deserializable)
			if err := d.Deserialize(buf); err != nil {
				slog.Error("Errore decodifica pacchetto framework", "topic", topic, "error", err)
				continue
			}

			handler(ctx, msg)
		}
	}
	return nil
}

// RegisterSubHandler registra un produttore di dati per i flussi in uscita (SUB).
// La libreria creerà un time.Ticker basato su 'interval' e invierà automaticamente
// il dato serializzato sulla rete ad ogni scatto del timer.
func RegisterSubHandler[T any](s *Server, topic string, interval time.Duration, producer func(context.Context) T) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.subHandlers[topic] = func(ctx context.Context, conn net.Conn) error {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return nil
			case <-ticker.C:
				// Otteniamo il dato fresco dall'applicazione
				msg := producer(ctx)

				// In Go, se un'interfaccia è implementata dal valore o dal puntatore,
				// estrarre l'indirizzo (&msg) copre in modo sicuro entrambi i casi.
				ser, ok := any(&msg).(Serializable)
				if !ok {
					return fmt.Errorf("netstream: il tipo %T non implementa Serializable", msg)
				}

				payload := ser.Serialize()
				if _, err := conn.Write(payload); err != nil {
					return err // Connessione interrotta dal client
				}
			}
		}
	}
}

// Start avvia il server TCP sulla porta specificata e blocca fino allo shutdown
func (s *Server) Start(ctx context.Context, addr string) error {
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("netstream.Server: ascolto fallito su %s: %w", addr, err)
	}

	// Chiusura automatica del listener al SIGTERM
	go func() {
		<-ctx.Done()
		listener.Close()
	}()

	var wg sync.WaitGroup

	for {
		conn, err := listener.Accept()
		if err != nil {
			if errors.Is(err, net.ErrClosed) {
				break
			}
			slog.Warn("Errore accettazione connessione server", "error", err)
			continue
		}

		// Lancio del client isolato e tracciato tramite wg.Go nativo
		wg.Go(func() {
			s.handleClient(ctx, conn)
		})
	}

	wg.Wait()
	slog.Info("Framework Server spento. Tutti i canali client drenati.", "indirizzo", addr)
	return nil
}

// handleClient esegue l'handshake e smista la connessione alla closure corretta
func (s *Server) handleClient(ctx context.Context, conn net.Conn) {
	defer conn.Close()

	clientCtx, clientCancel := context.WithCancel(ctx)
	defer clientCancel()

	go func() {
		<-clientCtx.Done()
		conn.Close()
	}()

	// Handshake Watchdog: 5 secondi di tempo massimo
	conn.SetDeadline(time.Now().Add(5 * time.Second))

	reader := bufio.NewReader(conn)
	line, err := reader.ReadString('\n')
	if err != nil {
		return
	}
	line = strings.TrimSpace(line)

	parts := strings.Split(line, " ")
	if len(parts) != 3 {
		fmt.Fprint(conn, "ERR: Formato handshake non valido\n")
		return
	}

	intent, topic, _ := parts[0], parts[1], parts[2]

	// Controllo centralizzato dei canali registrati
	s.mu.RLock()
	var worker connectionWorker
	var exists bool

	switch intent {
	case "PUB":
		worker, exists = s.pubHandlers[topic]
	case "SUB":
		worker, exists = s.subHandlers[topic]
	default:
		s.mu.RUnlock()
		fmt.Fprintf(conn, "ERR: Intento '%s' sconosciuto\n", intent)
		return
	}
	s.mu.RUnlock()

	if !exists {
		slog.Warn("Tentativo di connessione su un topic non registrato", "topic", topic, "intento", intent)
		fmt.Fprintf(conn, "ERR: Il topic '%s' non supporta la modalità %s su questo server\n", topic, intent)
		return
	}

	// Handshake approvato: azzeriamo le scadenze e inviamo OK
	conn.SetDeadline(time.Time{})
	fmt.Fprint(conn, "OK\n")

	slog.Info("Client agganciato con successo al framework", "intento", intent, "topic", topic)

	// Eseguiamo il ciclo binario della closure (PUB o SUB generato a runtime)
	if err := worker(clientCtx, conn); err != nil {
		slog.Info("Client disconnesso dal framework", "topic", topic)
	}
}
