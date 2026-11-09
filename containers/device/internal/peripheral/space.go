package peripheral

import (
	"sync"
)

// VariableSpace implementa l'interfaccia VariableCtx ed è il custode della RAM del nodo.
type VariableSpace struct {
	mu         sync.RWMutex
	values     map[string]float64
	properties map[string]float64

	// Callback di notifica interna verso i driver registrati.
	// Viene configurata dal Runtime per smistare gli eventi senza accoppiare lo spazio variabili.
	onWriteHook func(name string, newValue float64, ctx VariableCtx)
}

// NewVariableSpace istanzia e pre-alloca lo spazio di memoria basandosi sulla configurazione JSON.
// Questo garantisce ZERO allocazioni di nuove chiavi a runtime.
func NewRuntimeSpace(cfg *Config, onWriteHook func(name string, val float64, ctx VariableCtx)) *VariableSpace {
	vs := &VariableSpace{
		values:      make(map[string]float64, len(cfg.Variables)),
		properties:  make(map[string]float64, len(cfg.Properties)),
		onWriteHook: onWriteHook,
	}

	// Popoliamo le proprietà statiche a freddo
	for k, v := range cfg.Properties {
		vs.properties[k] = v
	}

	// Inizializziamo le chiavi delle variabili a 0.0 per blindare la mappa
	for k := range cfg.Variables {
		vs.values[k] = 0.0
	}

	return vs
}

// Get legge il valore di una variabile in modo thread-safe (Read-Lock)
func (vs *VariableSpace) Get(name string) float64 {
	vs.mu.RLock()
	defer vs.mu.RUnlock()

	// Se la variabile non esiste nel JSON, ritorniamo 0.0 senza far crashare il server
	return vs.values[name]
}

// GetProperty legge una proprietà di configurazione statica (Read-Lock)
func (vs *VariableSpace) GetProperty(name string) float64 {
	vs.mu.RLock()
	defer vs.mu.RUnlock()

	return vs.properties[name]
}

// Set aggiorna il valore di una variabile e notifica i driver in ascolto.
func (vs *VariableSpace) Set(name string, value float64) {
	vs.mu.Lock()
	
	oldValue, exists := vs.values[name]
	if !exists {
		vs.mu.Unlock()
		return // Ignoriamo scritture su variabili non censite nel JSON
	}

	// Ottimizzazione: se il valore non è cambiato, usciamo subito a costo zero
	if oldValue == value {
		vs.mu.Unlock()
		return
	}

	// Aggiorniamo la RAM
	vs.values[name] = value
	
	// ESTRATTO CRITICO DI SICUREZZA: Rilasciamo il Mutex PRIMA di invocare l'hook del driver.
	// Se il driver nel suo metodo OnVariableWrite facesse a sua volta una chiamata a vs.Get() 
	// o vs.Set(), con il Mutex ancora blindato causeremmo un Deadlock istantaneo e irreversibile.
	vs.mu.Unlock()

	// Invochiamo la notifica a catena se configurata
	if vs.onWriteHook != nil {
		vs.onWriteHook(name, value, vs)
	}
}
