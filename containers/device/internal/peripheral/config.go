package peripheral

// DataType definisce la codifica binaria e l'occupazione dei registri Modbus
type DataType string

const (
	TypeUint16      DataType = "uint16"       // 1 registro (16 bit) senza segno
	TypeInt16       DataType = "int16"        // 1 registro (16 bit) con segno
	TypeFloat32ABCD DataType = "float32"      // 2 registri (32 bit), Big-Endian
	TypeFloat32CDAB DataType = "float32_swap" // 2 registri (32 bit), Parole invertite
)

// ModbusMapping descrive come una variabile si interfaccia sul bus di campo
type ModbusMapping struct {
	Address uint16   `json:"address"`
	Kind    string   `json:"kind"`
	Type    DataType `json:"type"`
	Scale   float64  `json:"scale"` // Es: 100.0 per trasformare 23.45 in 2345
	Max     float64  `json:"max,omitempty"`
}

// VariableConfig unisce le identità industriali di un singolo punto dati astratto
type VariableConfig struct {
	Modbus       *ModbusMapping `json:"modbus,omitempty"`
	NetstreamPub string         `json:"netstream_pub,omitempty"`
	NetstreamSub string         `json:"netstream_sub,omitempty"`
}

// Config rappresenta il file JSON di configurazione di un intero nodo periferico
type Config struct {
	DeviceType    string                    `json:"device_type"`
	ModbusBind    string                    `json:"modbus_bind"`
	NetstreamAddr string                    `json:"netstream_addr"`
	Properties    map[string]float64        `json:"properties"`
	Variables     map[string]VariableConfig `json:"variables"`
}
