package netstream

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"strings"
	"time"
)

// Interfacce richieste dal protocollo binario per la validazione dei tipi di dato
type Sizer interface{ Size() int }
type Serializable interface{ Serialize() []byte }
type Deserializable interface{ Deserialize([]byte) error }

// ============================================================================
// 1. COMPONENTE SUBSCRIBER (RICEZIONE REATTIVA CON SOCKET UNICA)
// ============================================================================

type Subscriber[T any] struct {
	addr        string
	topic       string
	dataType    string
	messageSize int
	initialConn net.Conn // Custodisce la prima vera socket aperta a startup
}

// NewSubscriber esegue il primo dial e l'handshake in modo sincrono (Fail-Early).
func NewSubscriber[T any](ctx context.Context, addr string, topic string) (*Subscriber[T], error) {
	var dummy T
	sizer, ok := any(&dummy).(Sizer)
	if !ok {
		return nil, fmt.Errorf("netstream.Subscriber: il tipo %T non implementa Sizer", &dummy)
	}
	if _, ok := any(&dummy).(Deserializable); !ok {
		return nil, fmt.Errorf("netstream.Subscriber: il tipo %T non implementa Deserializable", &dummy)
	}

	messageSize := sizer.Size()
	dataType := fmt.Sprintf("%T", dummy)

	// Tentiamo la prima e unica connessione di boot
	conn, err := dialAndHandshake(ctx, addr, "SUB", topic, dataType)
	if err != nil {
		return nil, fmt.Errorf("netstream.Subscriber: connessione iniziale fallita per il topic '%s': %w", topic, err)
	}

	return &Subscriber[T]{
		addr:        addr,
		topic:       topic,
		dataType:    dataType,
		messageSize: messageSize,
		initialConn: conn,
	}, nil
}

// Listen avvia l'ascolto binario asincrono riutilizzando la socket di startup.
// Entra nel ciclo di riconnessione automatica solo se la linea cade a simulazione avviata.
func (s *Subscriber[T]) Listen(ctx context.Context, handler func(context.Context, T)) error {
	conn := s.initialConn
	s.initialConn = nil // Liberiamo il puntatore della connessione iniziale appena consumata

	for {
		// Avviamo il ciclo di ricezione binaria sulla socket corrente
		err := listenStream(ctx, conn, s.messageSize, handler)
		if conn != nil {
			conn.Close()
		}

		// Se il loop termina in modo pulito (es: contesto chiuso intenzionalmente), usciamo senza errori
		if err == nil || ctx.Err() != nil {
			return nil
		}

		slog.Warn("Subscriber: connessione interrotta, avvio ciclo di riconnessione", "topic", s.topic, "error", err)

		if !waitRetry(ctx, 2*time.Second) {
			return nil
		}

		// Tentativo di riconnessione a runtime in caso di blackout di rete
		var dialErr error
		conn, dialErr = dialAndHandshake(ctx, s.addr, "SUB", s.topic, s.dataType)
		if dialErr != nil {
			slog.Error("Subscriber: riconnessione fallita. Riprovo al prossimo tick...", "topic", s.topic, "error", dialErr)
			conn = nil // Forza il prossimo ciclo a ripassare dal waitRetry
			continue
		}

		slog.Info("Subscriber: canale dati riconnesso con successo", "topic", s.topic)
	}
}

func listenStream[T any](ctx context.Context, conn net.Conn, size int, handler func(context.Context, T)) error {
	if conn == nil {
		return fmt.Errorf("socket non inizializzata")
	}

	reader := bufio.NewReader(conn)
	buf := make([]byte, size)

	for {
		if ctx.Err() != nil {
			return nil
		}

		if _, err := io.ReadFull(reader, buf); err != nil {
			return err 
		}

		var msg T
		d, _ := any(&msg).(Deserializable)
		if err := d.Deserialize(buf); err != nil {
			slog.Error("Subscriber: errore decodifica messaggio", "error", err)
			continue
		}

		handler(ctx, msg)
	}
}

// ============================================================================
// 2. COMPONENTE PUBLISHER (TRASMISSIONE CON SOCKET UNICA E CODA BUFFER)
// ============================================================================

type Publisher[T any] struct {
	addr     string
	topic    string
	dataType string
	queue    chan T
}

// NewPublisher esegue la prima connessione sincrona ed alloca la coda protetta.
func NewPublisher[T any](ctx context.Context, addr string, topic string) (*Publisher[T], error) {
	var dummy T
	if _, ok := any(&dummy).(Serializable); !ok {
		return nil, fmt.Errorf("netstream.Publisher: il tipo %T non implementa Serializable", &dummy)
	}

	dataType := fmt.Sprintf("%T", dummy)

	// Tentiamo la prima e unica connessione di boot (Fail-Early)
	conn, err := dialAndHandshake(ctx, addr, "PUB", topic, dataType)
	if err != nil {
		return nil, fmt.Errorf("netstream.Publisher: connessione iniziale fallita per il topic '%s': %w", topic, err)
	}

	p := &Publisher[T]{
		addr:     addr,
		topic:    topic,
		dataType: dataType,
		queue:    make(chan T, 100),
	}

	// Passiamo la socket già attiva e funzionante al thread di invio in background
	go p.lifecycleLoop(ctx, conn)

	return p, nil
}

// Publish inserisce il messaggio nella coda in modo non bloccante e thread-safe.
func (p *Publisher[T]) Publish(msg T) {
	select {
	case p.queue <- msg:
	default:
		slog.Warn("Publisher: coda interna piena, messaggio scartato", "topic", p.topic)
	}
}

func (p *Publisher[T]) lifecycleLoop(ctx context.Context, initialConn net.Conn) {
	conn := initialConn

	for {
		// Svuota la coda trasmettendo i byte sulla socket corrente finché regge
		err := p.flushQueue(ctx, conn)
		if conn != nil {
			conn.Close()
		}

		// Uscita pulita se il contesto generale si chiude
		if err == nil || ctx.Err() != nil {
			return
		}

		slog.Warn("Publisher: connessione persa durante l'invio, avvio ciclo di riconnessione", "topic", p.topic, "error", err)

		if !waitRetry(ctx, 2*time.Second) {
			return
		}

		// Tentativo di ripristino del canale di trasmissione a runtime
		var dialErr error
		conn, dialErr = dialAndHandshake(ctx, p.addr, "PUB", p.topic, p.dataType)
		if dialErr != nil {
			slog.Error("Publisher: riconnessione fallita. Riprovo al prossimo tick...", "topic", p.topic, "error", dialErr)
			conn = nil
			continue
		}

		slog.Info("Publisher: canale di invio riconnesso con successo", "topic", p.topic)
	}
}

func (p *Publisher[T]) flushQueue(ctx context.Context, conn net.Conn) error {
	if conn == nil {
		return fmt.Errorf("socket non inizializzata")
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		case msg, ok := <-p.queue:
			if !ok {
				return nil
			}

			ser, _ := any(&msg).(Serializable)
			payload := ser.Serialize()

			if _, err := conn.Write(payload); err != nil {
				return err
			}
		}
	}
}

// ============================================================================
// 3. HELPER DI RETE CONDIVISI (INVARIATI MA OTTIMIZZATI)
// ============================================================================

func dialAndHandshake(ctx context.Context, addr, intent, topic, dataType string) (net.Conn, error) {
	var dialer net.Dialer
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, err
	}

	conn.SetDeadline(time.Now().Add(5 * time.Second))
	
	handshake := fmt.Sprintf("%s %s %s\n", intent, topic, dataType)
	if _, err := conn.Write([]byte(handshake)); err != nil {
		conn.Close()
		return nil, fmt.Errorf("invio handshake fallito: %w", err)
	}

	reader := bufio.NewReader(conn)
	resp, err := reader.ReadString('\n')
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("lettura risposta handshake fallita: %w", err)
	}

	if resp != "OK\n" {
		conn.Close()
		return nil, fmt.Errorf("handshake distribuito rifiutato dal server: %s", strings.TrimSpace(resp))
	}

	conn.SetDeadline(time.Time{})
	return conn, nil
}

func waitRetry(ctx context.Context, delay time.Duration) bool {
	select {
	case <-ctx.Done():
		return false
	case <-time.After(delay):
		return true
	}
}
