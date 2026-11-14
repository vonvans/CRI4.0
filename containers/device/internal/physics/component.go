package physics

import "fmt"
import "github.com/t3labit/cri40-scenario-tools/internal/config"

type Component interface {
	ID() string
	Type() string

	// Usati SOLO a startup per l'ispezione e la validazione del grafo
	Inputs() map[string]config.InternalUnit
	Outputs() map[string]config.InternalUnit

	// I NUOVI METODI: Restituiscono l'indirizzo di memoria della variabile.
	// Vengono invocati dall'Engine UNA VOLTA SOLA durante il setup.
	BindInput(port string) (*float64, error)
	BindOutput(port string) (*float64, error)

	// Il ciclo di runtime rimane magrissimo
	Tick(dt float64)
	Commit()
}

// DoubleBuffer implementa il pattern di isolamento dei transitori.
// Garantisce che chi legge veda lo stato stabile, mentre chi calcola scriva sul futuro.
type DoubleBuffer struct {
	Current float64 // Il valore consolidato nel tick precedente (Sola Lettura per l'esterno)
	Next    float64 // Il valore che si sta calcolando nel tick attuale (Sola Scrittura per il componente)
}

// Commit consolida il transitorio portando il futuro nel presente
func (db *DoubleBuffer) Commit() {
	db.Current = db.Next
}

// MultiInput gestisce una porta ad accumulo (N-a-1) azzerando la frammentazione della memoria.
// Alloca una slice contigua in RAM a startup. Sfruttando il fatto che il grafo è statico,
// evita la gestione di indici sparsi a runtime: si comporta come un allocatore lineare.
type MultiInput struct {
	slots []float64 // Array contiguo in RAM per massimizzare il cache-hit della CPU
	used  int       // Contatore degli slot effettivamente cablati dall'Engine
}

// NewMultiInput pre-alloca lo spazio in memoria per un numero massimo stimato di connessioni in ingresso
func NewMultiInput(maxConnections int) *MultiInput {
	return &MultiInput{
		slots: make([]float64, maxConnections),
		used:  0,
	}
}

// BindNextSlot viene chiamato dall'Engine durante il setup.
// Restituisce il puntatore diretto all'elemento dell'array e avanza l'indice.
func (mi *MultiInput) BindNextSlot() (*float64, error) {
	if mi.used >= len(mi.slots) {
		return nil, fmt.Errorf("capacità massima della porta di accumulo raggiunta (%d slot)", len(mi.slots))
	}
	
	// Prendiamo l'indirizzo della cella di memoria contigua
	ptr := &mi.slots[mi.used]
	mi.used++
	return ptr, nil
}

// GetSignals restituisce la sotto-slice contenente solo i valori effettivamente connessi.
// Utilissimo per i componenti che devono fare medie, logiche custom o iterazioni.
func (mi *MultiInput) GetSignals() []float64 {
	return mi.slots[:mi.used]
}

// Sum è una funzione helper ad alte prestazioni che restituisce la somma algebrica
// di tutti i contributi propagati in questa porta, ottimizzata dal compilatore Go.
func (mi *MultiInput) Sum() float64 {
	sum := 0.0
	for i := 0; i < mi.used; i++ {
		sum += mi.slots[i]
	}
	return sum
}

