package peripheral

import (
	"context"
	"encoding/json"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// BootstrapAndExecute è il punto di ingresso universale del framework.
// Si occupa di fare il parsing dei flag, caricare la topologia dei dati,
// agganciare i driver e gestire la concorrenza di rete a eventi.
func BootstrapAndExecute() {
	// 1. CONFIGURAZIONE CLI: Otteniamo il percorso del file di configurazione specifico
	configPath := flag.String("config", "peripheral.json", "Percorso del file JSON di configurazione della periferica")
	flag.Parse()

	// Configurazione del logger strutturato di sistema
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	slog.Info("Peripheral Framework: Avvio del processo di inizializzazione...")

	// 2. CARICAMENTO CONFIGURAZIONE: Lettura e parsing del file JSON dinamico
	cfgFile, err := os.ReadFile(*configPath)
	if err != nil {
		slog.Error("Impossibile leggere il file di configurazione JSON", "path", *configPath, "error", err)
		os.Exit(1)
	}

	var cfg Config
	if err := json.Unmarshal(cfgFile, &cfg); err != nil {
		slog.Error("Errore nel parsing sintattico del JSON di configurazione", "error", err)
		os.Exit(1)
	}

	slog.Info("Configurazione caricata con successo", "device_type", cfg.DeviceType, "modbus_bind", cfg.ModbusBind)

	// 3. ISTANZIAZIONE DINAMICA DEL DRIVER: Ricerca della factory registrata nel main
	driver, err := NewDriverInstance(cfg.DeviceType)
	if err != nil {
		slog.Error("Errore fatale a startup", "error", err)
		os.Exit(1)
	}

	// 4. PRE-ALLOCAZIONE RAM: Creazione dello VariableSpace protetto
	// Definiamo qui la funzione di hook reattiva che farà da ponte tra la RAM e la rete.
	var ntManager *NetstreamManager
	
	onWriteHook := func(name string, value float64, ctx VariableCtx) {
		// A. Se la variabile è mappata in uscita (PUB), la scarica sulla coda del Publisher Netstream
		if ntManager != nil {
			ntManager.HandleRuntimePublish(name, value)
		}
		// B. Notifica immediatamente il Driver dell'evento di scrittura avvenuto
		driver.OnVariableWrite(name, value, ctx)
	}

	space := NewRuntimeSpace(&cfg, onWriteHook)

	// 5. ALLOCAZIONE DEI MANAGER DI RETE
	ntManager = NewNetstreamManager(&cfg, space)
	modbusManager := NewModbusManager(&cfg, space)

	// 6. GESTIONE DEL CONTESTO: Cattura dei segnali OS per l'arresto grazioso
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 7. DRIVER INIT: Esecuzione della logica di configurazione iniziale del codice custom
	if err := driver.Init(space); err != nil {
		slog.Error("Il Driver ha fallito la fase di inizializzazione interna (Init)", "error", err)
		os.Exit(1)
	}

	// 8. CONTROLLO CONNESSI NETSTREAM (FAIL-EARLY): Connessione reale e unica verso la fisica
	if err := ntManager.Connect(ctx); err != nil {
		slog.Error("Fase di Setup fallita. Simulatore fisico irraggiungibile", "error", err)
		os.Exit(1)
	}

	// force initial synchronization
	ntManager.ForceInitialPublish()

	// 9. COINVOLGIMENTO DELLA WAITGROUP PER L'ESECUZIONE PARALLELA
	var wg sync.WaitGroup

	// Avvio del server Modbus TCP (OT)
	if err := modbusManager.Start(ctx, &wg); err != nil {
		slog.Error("Impossibile avviare il server Modbus TCP", "error", err)
		os.Exit(1)
	}

	// Avvio dei cicli di ascolto asincroni in ingresso da Netstream (SUB)
	ntManager.StartInboundLoops(ctx, &wg)

	// 10. AVVIO DEL TICKER CINEMATICO (Se richiesto esplicitamente dal Driver)
	tickInterval := driver.TickInterval()
	if tickInterval > 0 {
		wg.Go(func() {
			slog.Info("Ciclo temporale continuo avviato per il Driver", "interval", tickInterval)
			ticker := time.NewTicker(tickInterval)
			defer ticker.Stop()

			lastTick := time.Now()

			for {
				select {
				case <-ctx.Done():
					slog.Info("Ciclo temporale del Driver interrotto.")
					return
				case now := <-ticker.C:
					// Calcolo del dt reale per garantire il determinismo matematico delle rampe
					dt := now.Sub(lastTick).Seconds()
					lastTick = now

					// Eseguiamo il passo di calcolo cinematico o logico sulla RAM isolata
					driver.OnTick(dt, space)
				}
			}
		})
	}

	slog.Info("Periferica di campo completamente avviata e operativa sul bus.")

	// Blocco principale in attesa dello stop del sistema
	<-ctx.Done()
	slog.Warn("Segnale di stop intercettato! Drenaggio dei canali di rete e arresto dei moduli...")

	// Attendiamo che tutte le goroutine (Modbus, Netstream, Ticker) terminino in modo pulito
	wg.Wait()
	slog.Info("Dispositivo periferico arrestato con successo. Stato di rete coerente.")
}
