package modbus

import (
	"encoding/binary"
	"io"
	"log/slog"
	"net"
	"sync"
)

// Handle prende in carico la connessione TCP e applica la logica Modbus
func Handle(wg *sync.WaitGroup, clientConn, targetConn net.Conn, plugins []any, logger *slog.Logger) {
	// Filtriamo solo i plugin che implementano l'interfaccia Modbus
	var modbusPlugins []Interceptor
	for _, p := range plugins {
		if mp, ok := p.(Interceptor); ok {
			modbusPlugins = append(modbusPlugins, mp)
		}
	}

	wg.Add(2)
	// Client -> Target (Richieste)
	go pump(wg, clientConn, targetConn, true, modbusPlugins, logger)
	// Target -> Client (Risposte)
	go pump(wg, targetConn, clientConn, false, modbusPlugins, logger)
}

func pump(wg *sync.WaitGroup, src, dst net.Conn, isRequest bool, plugins []Interceptor, logger *slog.Logger) {
	defer wg.Done()

	// Interfaccia per fare CloseWrite sicuro come avevamo fatto prima
	type closeWriter interface{ CloseWrite() error }
	defer func() {
		if cw, ok := dst.(closeWriter); ok {
			cw.CloseWrite()
		}
	}()

	for {
		// 1. Lettura Header MBAP (sempre 7 byte)
		mbap := make([]byte, 7)
		if _, err := io.ReadFull(src, mbap); err != nil {
			if err != io.EOF {
				logger.Error("Errore lettura MBAP", "err", err)
			}
			return
		}

		// 2. Lettura PDU
		// La lunghezza (byte 4 e 5) indica quanti byte seguono: Unit ID (1 byte) + PDU vera e propria.
		// Dato che abbiamo già letto 7 byte (l'MBAP), mbap[6] è il nostro Unit ID!
		length := binary.BigEndian.Uint16(mbap[4:6])
		
		// Dobbiamo leggere solo il resto del pacchetto (cioè length - 1)
		pdu := make([]byte, length-1) 
		if _, err := io.ReadFull(src, pdu); err != nil {
			logger.Error("Errore lettura PDU Modbus", "err", err)
			return
		}

		// Per comodità dei plugin, uniamo UnitID (mbap[6]) e PDU in un'unica slice
		fullPDU := append([]byte{mbap[6]}, pdu...)

		// 3. Esecuzione degli Interceptor
		var err error
		for _, p := range plugins {
			if isRequest {
				mbap, fullPDU, err = p.OnRequest(mbap, fullPDU, logger)
			} else {
				mbap, fullPDU, err = p.OnResponse(mbap, fullPDU, logger)
			}
			if err != nil {
				logger.Warn("Plugin ha interrotto il flusso Modbus", "err", err)
				return // Droppa connessione
			}
		}

		// 4. Scrittura a destinazione
		// Ricalcoliamo la lunghezza in caso il plugin abbia alterato il contenuto
		binary.BigEndian.PutUint16(mbap[4:6], uint16(len(fullPDU)))
		// Aggiorniamo l'Unit ID nell'MBAP casomai un plugin lo abbia dirottato
		mbap[6] = fullPDU[0]

		// Scriviamo prima i 7 byte dell'MBAP (che ora contengono l'UnitID corretto)
		if _, err := dst.Write(mbap); err != nil {
			return
		}
		// Scriviamo il resto della PDU (escludendo il primo byte che è l'UnitID appena scritto!)
		if _, err := dst.Write(fullPDU[1:]); err != nil {
			return
		}
	}
}

