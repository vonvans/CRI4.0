package dumplogger

import (
	"encoding/hex"
	"log/slog"
	"net"

	"github.com/t3labit/netproxy_cri/internal/interceptor"
)

type DumpLogger struct{}

// For TCP
func (d *DumpLogger) OnData(data []byte, isClientToServer bool, logger *slog.Logger) ([]byte, error) {
	direction := "C->S"
	if !isClientToServer {
		direction = "S->C"
	}
	
	// Il logger contiene già implicitamente le chiavi "rule" e "client"
	logger.Debug("TCP Intercepted",
		"dir", direction,
		"bytes", len(data),
		"payload_hex", hex.EncodeToString(data),
	)
	
	return data, nil
}

// For UDP
func (d *DumpLogger) OnPacket(data []byte, isClientToServer bool, clientAddr *net.UDPAddr, logger *slog.Logger) ([]byte, error) {
	direction := "C->S"
	if !isClientToServer {
		direction = "S->C"
	}

	// Anche qui, il logger iniettato ha già il client, ma possiamo usare il clientAddr
	// per indicare esplicitamente da/verso chi sta andando questo specifico pacchetto
	logger.Debug("UDP Intercepted",
		"dir", direction,
		"client", clientAddr.String(),
		"bytes", len(data),
		"payload_hex", hex.EncodeToString(data),
	)
	
	return data, nil
}

func init() {
	// Registriamo il plugin di esempio all'avvio
	interceptor.Register("dumplogger", func() any {
		return &DumpLogger{}
	})
}

