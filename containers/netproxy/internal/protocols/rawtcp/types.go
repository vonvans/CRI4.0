package rawtcp

import "log/slog"

type Interceptor interface {
	// Restituisce i dati (eventualmente modificati) o un errore per droppare la connessione
	OnData(data []byte, isClientToServer bool, logger *slog.Logger) ([]byte, error)
}

