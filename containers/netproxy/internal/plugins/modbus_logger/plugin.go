package modbus_logger

import (
	"log/slog"

	"github.com/t3labit/netproxy_cri/internal/interceptor"
)

type MbdLogger struct{}

func (m *MbdLogger) OnRequest(mbap []byte, pdu []byte, logger *slog.Logger) ([]byte, []byte, error) {
	unitID := pdu[0]
	funcCode := pdu[1]
	logger.Info("Modbus Request", "tx_id", mbap[0:2], "unit", unitID, "func", funcCode)
	return mbap, pdu, nil
}

func (m *MbdLogger) OnResponse(mbap []byte, pdu []byte, logger *slog.Logger) ([]byte, []byte, error) {
	funcCode := pdu[1]
	logger.Info("Modbus Response", "tx_id", mbap[0:2], "func", funcCode, "len", len(pdu))
	return mbap, pdu, nil
}

func init() {
	interceptor.Register("modbus_logger", func() any {
		return &MbdLogger{}
	})
}
