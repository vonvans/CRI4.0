package modbus

import "log/slog"

// ModbusInterceptor definisce gli eventi specifici per questo protocollo.
// Un plugin può implementarli tutti o solo alcuni (se separiamo in più interfacce, 
// ma per semplicità ora usiamo un'unica interfaccia).
type Interceptor interface {
	// Chiamato quando il client invia una richiesta al server
	OnRequest(mbap []byte, pdu []byte, logger *slog.Logger) ([]byte, []byte, error)
	
	// Chiamato quando il server risponde al client
	OnResponse(mbap []byte, pdu []byte, logger *slog.Logger) ([]byte, []byte, error)
}

