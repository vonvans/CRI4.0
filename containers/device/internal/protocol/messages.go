package protocol

import (
	"encoding/binary"
	"fmt"
	"math"
)

// FloatSignal rappresenta il pacchetto di rete standard a dimensione fissa.
// Trasporta un singolo float64 mappato in 8 byte puri sulla socket TCP.
type FloatSignal struct {
	Value float64 `json:"val"`
}

// Size dichiara che il messaggio occupa stabilmente 8 byte in memoria.
// Soddisfa l'interfaccia netstream.Sizer richiesta dal server e dal subscriber.
func (m *FloatSignal) Size() int {
	return 8
}

// Serialize converte il float64 in una sequenza di 8 byte (Big Endian).
// Soddisfa l'interfaccia netstream.Serializable richiesta dal publisher.
func (m *FloatSignal) Serialize() []byte {
	buf := make([]byte, 8)
	bits := math.Float64bits(m.Value)
	binary.BigEndian.PutUint64(buf, bits)
	return buf
}

// Deserialize ricompone il float64 originale partendo dagli 8 byte grezzi della rete.
// Soddisfa l'interfaccia netstream.Deserializable richiesta dal server e dal subscriber.
func (m *FloatSignal) Deserialize(b []byte) error {
	if len(b) < 8 {
		return fmt.Errorf("float_signal: payload troppo corto (ricevuti %d byte, attesi 8)", len(b))
	}
	bits := binary.BigEndian.Uint64(b[:8])
	m.Value = math.Float64frombits(bits)
	return nil
}
