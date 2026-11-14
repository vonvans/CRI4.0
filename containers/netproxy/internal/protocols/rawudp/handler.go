package rawudp

import (
	"log/slog"
	"net"
)

// ProcessPacket applica la catena di interceptor UDP a un singolo datagramma
func ProcessPacket(data []byte, isC2S bool, clientAddr *net.UDPAddr, plugins []any, logger *slog.Logger) ([]byte, error) {
	// Filtriamo i plugin compatibili con UDP
	var rawUDPPlugins []Interceptor
	for _, p := range plugins {
		if up, ok := p.(Interceptor); ok {
			rawUDPPlugins = append(rawUDPPlugins, up)
		}
	}

	var err error
	for _, plugin := range rawUDPPlugins {
		data, err = plugin.OnPacket(data, isC2S, clientAddr, logger)
		if err != nil {
			return nil, err // Il plugin ha causato un errore
		}
		if len(data) == 0 {
			return nil, nil // Il plugin ha silenziato il pacchetto (drop)
		}
	}

	return data, nil
}

