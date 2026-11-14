package rawtcp

import (
	"io"
	"log/slog"
	"net"
	"sync"
)

// closeWriter permette di fare un cast sicuro per chiamare CloseWrite
// senza fare assunzioni sul tipo esatto sottostante (TCPConn, UnixConn, ecc.)
type closeWriter interface {
	CloseWrite() error
}

func copyWithIntercept(dst net.Conn, src net.Conn, isClientToServer bool, plugins []Interceptor, logger *slog.Logger) error {
	buf := make([]byte, 32*1024) // Buffer da 32KB
	for {
		n, err := src.Read(buf)
		if n > 0 {
			data := buf[:n]
			
			// --- LOGICA PLUGIN ---
			for _, plugin := range plugins {
				data, err = plugin.OnData(data, isClientToServer, logger)
				if err != nil {
					return err // Il plugin ha deciso di droppare la connessione
				}
			}
			// ---------------------

			if len(data) > 0 {
				_, writeErr := dst.Write(data)
				if writeErr != nil {
					return writeErr
				}
			}
		}
		if err != nil {
			if err == io.EOF {
				return nil // Connessione chiusa regolarmente
			}
			return err
		}
	}
}

func pipe(wg *sync.WaitGroup, dst net.Conn, src net.Conn, isClientToServer bool, plugins []Interceptor, logger *slog.Logger) {
	defer wg.Done()

	// Chiusura sicura: controlliamo se la destinazione supporta CloseWrite
	defer func() {
		if cw, ok := dst.(closeWriter); ok {
			cw.CloseWrite()
		}
	}()

	// Direct copy if no plugin is available
	if len(plugins) == 0 {
		io.Copy(dst, src)
		return
	}
	copyWithIntercept(dst, src, isClientToServer, plugins, logger)
}

func Handle(wg *sync.WaitGroup, clientConn, targetConn net.Conn, plugins []any, logger *slog.Logger) {
	// Filtriamo solo i plugin che implementano l'interfaccia Modbus
	var rawTCPPlugins []Interceptor
	for _, p := range plugins {
		if mp, ok := p.(Interceptor); ok {
			rawTCPPlugins = append(rawTCPPlugins, mp)
		}
	}
	wg.Add(2)
	// Client -> Target (Richieste)
	go pipe(wg, targetConn, clientConn, true, rawTCPPlugins, logger)
	// Target -> Client (Risposte)
	go pipe(wg, clientConn, targetConn, false, rawTCPPlugins, logger)
}

