package physics

import (
	"fmt"
	"log/slog"
	"maps"
	"reflect"
	"sync"

	"github.com/t3labit/cri40-scenario-tools/internal/config"
)

// ComponentFactory è la firma della funzione che ogni blocco fisico deve registrare
type ComponentFactory func(id string, properties map[string]config.Property, portCapacities map[string]int) (Component, error)

// Registro globale delle factory dei componenti accessibili a startup
var factoryRegistry = make(map[string]ComponentFactory)

// RegisterComponentType permette ai singoli pacchetti di componenti di registrarsi a startup
func RegisterComponentType(componentType string, factory ComponentFactory) {
	factoryRegistry[componentType] = factory
}

// RuntimeConnection rappresenta un singolo filo di rame virtuale ottimizzato.
// A regime, evita qualsiasi look-up di mappe o stringhe.
type RuntimeConnection struct {
	Src *float64 // Punta alla variabile .Current dell'output sorgente
	Dst *float64 // Punta alla variabile dell'input di destinazione
}

// RuntimeSnapshot rappresenta lo stato dinamico di un singolo blocco
type RuntimeSnapshot struct {
	Inputs  map[string]float64 `json:"inputs"`
	Outputs map[string]float64 `json:"outputs"`
}

// trackedField unisce la destinazione della cache al puntatore reale in memoria RAM
type trackedField struct {
	targetMap map[string]float64
	key       string
	ptr       *float64
	multi     *MultiInput // Valorizzato solo se la porta è un MultiInput ad accumulo
}

// Engine è il cuore pulsante del simulatore deterministico
type Engine struct {
	dtSeconds  float64
	components map[string]Component
	pipelines  []RuntimeConnection

	// ============================================================================
	// NUOVI CAMPI: Protezione e Caching per il Frontend Visivo
	// ============================================================================
	stateMu      sync.RWMutex
	runtimeCache map[string]RuntimeSnapshot
	trackedFields []trackedField
	rawConfig    *config.SimulationConfig
}

// NewEngine prende il DTO di configurazione validato, istanzia i componenti
// tramite la factory ed esegue la "compilazione" del grafo risolvendo i puntatori.
func NewEngine(cfg *config.SimulationConfig) (*Engine, error) {
	sim := cfg.Simulation

	e := &Engine{
		dtSeconds:  sim.DtSeconds,
		components: make(map[string]Component),
		pipelines:  make([]RuntimeConnection, 0, len(sim.Connections)),
		runtimeCache: make(map[string]RuntimeSnapshot),
		trackedFields: make([]trackedField, 0),
		rawConfig:    cfg,
	}

	// ------------------------------------------------------------------------
	// PRE-SCANSIONE: Calcolo esatto delle capacità delle porte di input (N-a-1)
	// ------------------------------------------------------------------------
	// mappa: componentID -> portName -> numero di connessioni in ingresso
	graphCapacities := make(map[string]map[string]int)
	for _, conn := range sim.Connections {
		if _, exists := graphCapacities[conn.To.Component]; !exists {
			graphCapacities[conn.To.Component] = make(map[string]int)
		}
		graphCapacities[conn.To.Component][conn.To.Port]++
	}

	// 1. ISTANZIAMO L'AMBIENTE CON LE SUE CAPACITÀ REALI
	envFactory, envExists := factoryRegistry["environment"]
	if !envExists {
		return nil, fmt.Errorf("engine: factory 'environment' non registrata")
	}
	
	envCaps := graphCapacities[sim.Environment.ID] // Può essere nil se nessuno scrive nell'ambiente
	envComponent, err := envFactory(sim.Environment.ID, sim.Environment.Properties, envCaps)
	if err != nil {
		return nil, fmt.Errorf("engine: errore creazione ambiente: %w", err)
	}
	e.components[sim.Environment.ID] = envComponent

	// 2. ISTANZIAMO I COMPONENTI STANDARD
	for _, compCfg := range sim.Components {
		factory, exists := factoryRegistry[compCfg.Type]
		if !exists {
			return nil, fmt.Errorf("engine: tipo '%s' non registrato", compCfg.Type)
		}

		compCaps := graphCapacities[compCfg.ID]
		comp, err := factory(compCfg.ID, compCfg.Properties, compCaps)
		if err != nil {
			return nil, fmt.Errorf("engine: errore creazione componente '%s': %w", compCfg.ID, err)
		}
		e.components[compCfg.ID] = comp
	}

	// 3. COMPILAZIONE DEI FILI (Identico a prima, ma ora la RAM è blindata e protetta)
	for i, conn := range sim.Connections {
		srcComp := e.components[conn.From.Component]
		dstComp := e.components[conn.To.Component]

		if outUnit, outExists := srcComp.Outputs()[conn.From.Port]; !outExists {
			return nil, fmt.Errorf("engine: output inesistente %s.%s", conn.From.Component, conn.From.Port)
		} else if inUnit, inExists := dstComp.Inputs()[conn.To.Port]; !inExists {
			return nil, fmt.Errorf("engine: input inesistente %s.%s", conn.To.Component, conn.To.Port)
		} else if outUnit != inUnit {
			return nil, fmt.Errorf("engine: errore dimensionale nella connessione [%d]", i)
		}

		srcPtr, err := srcComp.BindOutput(conn.From.Port)
		if err != nil {
			return nil, fmt.Errorf("engine: errore binding output su %s.%s: %w", conn.From.Component, conn.From.Port, err)
		}
		dstPtr, err := dstComp.BindInput(conn.To.Port)
		if err != nil {
			return nil, fmt.Errorf("engine: errore binding input su %s.%s: %w", conn.To.Component, conn.To.Port, err)
		}

		e.pipelines = append(e.pipelines, RuntimeConnection{Src: srcPtr, Dst: dstPtr})
	}

	if err := e.compileWatchFields(); err != nil {
		return nil, fmt.Errorf("engine: errore compilazione mappatura visiva: %w", err)
	}

	slog.Info("Grafo fisico allocato staticamente e compilato in RAM", 
		"componenti", len(e.components), "connessioni", len(e.pipelines))

	return e, nil
}

// compileWatchFields viene eseguito UNA VOLTA SOLA a startup.
// Inizializza le mappe stabili e colleziona i puntatori diretti della RAM.
func (e *Engine) compileWatchFields() error {
	for id, comp := range e.components {
		// Inizializziamo lo slot della cache una volta per tutte
		snap := RuntimeSnapshot{
			Inputs:  make(map[string]float64),
			Outputs: make(map[string]float64),
		}
		e.runtimeCache[id] = snap

		// Scansioniamo l'oggetto reale tramite reflection una tantum
		v := reflect.ValueOf(comp).Elem()
		t := v.Type()

		for i := 0; i < t.NumField(); i++ {
			// Sfruttiamo la logica di parseTag interna già presente in reflect.go
			// Nota: se la funzione non è esportata, assicurati che sia accessibile nel pacchetto
			tag, ok := parseTag(t.Field(i)) 
			if !ok {
				continue
			}

			fieldVal := v.Field(i)
			switch tag.Kind {
			case "input":
				// Registriamo la chiave nella mappa stabile
				snap.Inputs[tag.Name] = 0.0
				
				if fieldVal.Type() == reflect.TypeFor[*MultiInput]() {
					mi := fieldVal.Interface().(*MultiInput)
					e.trackedFields = append(e.trackedFields, trackedField{
						targetMap: snap.Inputs,
						key:       tag.Name,
						multi:     mi,
					})
				} else if fieldVal.Kind() == reflect.Float64 {
					ptr := fieldVal.Addr().Interface().(*float64)
					e.trackedFields = append(e.trackedFields, trackedField{
						targetMap: snap.Inputs,
						key:       tag.Name,
						ptr:       ptr,
					})
				}

			case "output":
				// Registriamo la chiave nella mappa stabile
				snap.Outputs[tag.Name] = 0.0
				
				if fieldVal.Type() == reflect.TypeFor[DoubleBuffer]() {
					// Puntiamo direttamente alla variabile .Current del DoubleBuffer
					ptr := fieldVal.FieldByName("Current").Addr().Interface().(*float64)
					e.trackedFields = append(e.trackedFields, trackedField{
						targetMap: snap.Outputs,
						key:       tag.Name,
						ptr:       ptr,
					})
				}
			}
		}
	}
	return nil
}

// Progress fa avanzare l'intero universo fisico di un passo temporale dtSeconds.
// Questo ciclo è ottimizzato per azzerare l'overhead di CPU a regime.
func (e *Engine) Progress() {
	// FASE 1: Tutti i componenti leggono i propri input locali stabili,
	// calcolano le equazioni fisiche in isolamento e scrivono sul proprio buffer .Next
	for _, comp := range e.components {
		comp.Tick(e.dtSeconds)
	}

	// FASE 2: Tutti i componenti consolidano lo stato transitorio.
	// Copiano internamente la memoria .Next nella memoria stabile .Current
	for _, comp := range e.components {
		comp.Commit()
	}

	// FASE 3: PROPAGAZIONE DEI SEGNALI (Copia RAM-to-RAM).
	// Sposta i valori correnti appena consolidati dagli output verso gli input collegati.
	for i := range e.pipelines {
		*e.pipelines[i].Dst = *e.pipelines[i].Src
	}

	e.updateRuntimeCache()
}

func (e *Engine) updateRuntimeCache() {
	e.stateMu.Lock()
	defer e.stateMu.Unlock()

	for i := range e.trackedFields {
		tf := &e.trackedFields[i]
		if tf.multi != nil {
			tf.targetMap[tf.key] = tf.multi.Sum()
		} else {
			tf.targetMap[tf.key] = *tf.ptr
		}
	}
}

func (e *Engine) GetTopology() *config.SimulationConfig {
	return e.rawConfig
}

func (e *Engine) GetRuntimeSnapshot() map[string]RuntimeSnapshot {
	e.stateMu.RLock()
	defer e.stateMu.RUnlock()

	snap := make(map[string]RuntimeSnapshot, len(e.runtimeCache))
	for id, compSnap := range e.runtimeCache {
		inputsCopy := make(map[string]float64, len(compSnap.Inputs))
		maps.Copy(inputsCopy, compSnap.Inputs)

		outputsCopy := make(map[string]float64, len(compSnap.Outputs))
		maps.Copy(outputsCopy, compSnap.Outputs)

		snap[id] = RuntimeSnapshot{
			Inputs:  inputsCopy,
			Outputs: outputsCopy,
		}
	}
	return snap
}

// GetComponent ci servirà per esporre le variabili verso il Gateway di rete (netstream)
func (e *Engine) GetComponent(id string) (Component, bool) {
	comp, exists := e.components[id]
	return comp, exists
}
