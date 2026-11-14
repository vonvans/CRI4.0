package peripheral

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"sync"

	"github.com/simonvetter/modbus"
)

type ModbusManager struct {
	cfg            *Config
	space          *VariableSpace
	server         *modbus.ModbusServer
	holdingRegToVar map[uint16]string        // Lookup per FC03/06/16
	inputRegToVar   map[uint16]string        // Lookup per FC04 (Sensori)
	varToReg       map[string]ModbusMapping
}

func NewModbusManager(cfg *Config, space *VariableSpace) *ModbusManager {
	mm := &ModbusManager{
		cfg:             cfg,
		space:           space,
		holdingRegToVar: make(map[uint16]string),
		inputRegToVar:   make(map[uint16]string),
		varToReg:        make(map[string]ModbusMapping),
	}

	for varName, varCfg := range cfg.Variables {
		if varCfg.Modbus != nil {
			mapping := *varCfg.Modbus
			mm.varToReg[varName] = mapping

			// Smistiamo gli indirizzi nei rispettivi banchi di memoria Modbus
			if mapping.Kind == "input" {
				mm.inputRegToVar[mapping.Address] = varName
				if mapping.Type == TypeFloat32ABCD || mapping.Type == TypeFloat32CDAB {
					mm.inputRegToVar[mapping.Address+1] = varName
				}
			} else { // assuming "holding"
				mm.holdingRegToVar[mapping.Address] = varName
				if mapping.Type == TypeFloat32ABCD || mapping.Type == TypeFloat32CDAB {
					mm.holdingRegToVar[mapping.Address+1] = varName
				}
			}
		}
	}

	return mm
}

// Start inizializza il server passando l'handler direttamente nel costruttore NewServer
func (mm *ModbusManager) Start(ctx context.Context, wg *sync.WaitGroup) error {
	// Assicuriamoci che la stringa di bind abbia il prefisso richiesto dalla libreria
	endpoint := mm.cfg.ModbusBind
	if !strings.HasPrefix(endpoint, "tcp://") {
		endpoint = "tcp://" + endpoint
	}

	// Configurazione coerente con il tuo main di riferimento
	serverCfg := &modbus.ServerConfiguration{
		URL: endpoint,
	}

	// Costruttore corretto della v1.6.4: Config + Handler (mm implementa l'interfaccia)
	server, err := modbus.NewServer(serverCfg, mm)
	if err != nil {
		return fmt.Errorf("modbus_manager: errore creazione server: %w", err)
	}
	mm.server = server

	wg.Go(func() {
		slog.Info("Server Modbus TCP Slave (v1.6.4) in ascolto attivo", "url", endpoint)
		if err := mm.server.Start(); err != nil {
			slog.Error("Server Modbus interrotto", "error", err)
		}
	})

	wg.Go(func() {
		<-ctx.Done()
		slog.Info("Arresto controllato del server Modbus...")
		mm.server.Stop()
	})

	return nil
}

// ============================================================================
// IMPLEMENTAZIONE COMPATIBILE DELLE INTERFACCE DI REGISTRO
// ============================================================================

// HandleInputRegisters gestisce le letture dei sensori (FC04)
func (mm *ModbusManager) HandleInputRegisters(req *modbus.InputRegistersRequest) (res []uint16, err error) {
	varName, exists := mm.inputRegToVar[req.Addr]
	if !exists {
		return nil, modbus.ErrIllegalDataAddress
	}

	return mm.readVariable(varName, req.Quantity), nil
}

// HandleHoldingRegisters gestisce letture/scritture degli attuatori (FC03, FC06, FC16)
func (mm *ModbusManager) HandleHoldingRegisters(req *modbus.HoldingRegistersRequest) (res []uint16, err error) {
	varName, exists := mm.holdingRegToVar[req.Addr]
	if !exists {
		return nil, modbus.ErrIllegalDataAddress
	}

	mapping := mm.varToReg[varName]

	// Scrittura da parte del PLC
	if req.IsWrite {
		var finalValue float64

		switch mapping.Type {
		case TypeUint16:
			finalValue = float64(req.Args[0]) / mapping.Scale
		case TypeInt16:
			finalValue = float64(int16(req.Args[0])) / mapping.Scale
		case TypeFloat32ABCD, TypeFloat32CDAB:
			if len(req.Args) < 2 {
				return nil, modbus.ErrIllegalDataValue
			}
			w1 := req.Args[0]
			w2 := req.Args[1]

			var bits uint32
			if mapping.Type == TypeFloat32ABCD {
				bits = (uint32(w1) << 16) | uint32(w2)
			} else {
				bits = (uint32(w2) << 16) | uint32(w1)
			}
			finalValue = float64(math.Float32frombits(bits))
		}

		if mapping.Max > 0 && finalValue > mapping.Max {
			return nil, modbus.ErrIllegalDataValue
		}

		mm.space.Set(varName, finalValue)
		return req.Args, nil
	}

	// Lettura da parte del PLC
	return mm.readVariable(varName, req.Quantity), nil
}

// Helper interno per evitare duplicazioni tra FC03 e FC04 in lettura
func (mm *ModbusManager) readVariable(varName string, quantity uint16) []uint16 {
	mapping := mm.varToReg[varName]
	currentValue := mm.space.Get(varName)
	response := make([]uint16, quantity)

	switch mapping.Type {
	case TypeUint16:
		response[0] = uint16(currentValue * mapping.Scale)
	case TypeInt16:
		response[0] = uint16(int16(currentValue * mapping.Scale))
	case TypeFloat32ABCD, TypeFloat32CDAB:
		bits := math.Float32bits(float32(currentValue))
		w1 := uint16(bits >> 16)
		w2 := uint16(bits & 0xFFFF)

		if mapping.Type == TypeFloat32ABCD {
			response[0] = w1
			if quantity > 1 { response[1] = w2 }
		} else {
			response[0] = w2
			if quantity > 1 { response[1] = w1 }
		}
	}
	return response
}

func (mm *ModbusManager) HandleCoils(req *modbus.CoilsRequest) (res []bool, err error) { 
	return nil, modbus.ErrIllegalFunction 
}
func (mm *ModbusManager) HandleDiscreteInputs(req *modbus.DiscreteInputsRequest) (res []bool, err error) { 
	return nil, modbus.ErrIllegalFunction 
}
