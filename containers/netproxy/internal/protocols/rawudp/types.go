package rawudp

import (
	"log/slog"
	"net"
)

type Interceptor interface {
	// OnPacket riceve un intero datagramma UDP. 
	// Se restituisce un errore o una slice vuota ([]byte{}), il pacchetto viene droppato.
	OnPacket(data []byte, isClientToServer bool, clientAddr *net.UDPAddr, logger *slog.Logger) ([]byte, error)
}
