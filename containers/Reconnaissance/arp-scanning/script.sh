#!/bin/sh
# arp_scan.sh
# Uso:
#   ./arp_scan.sh <target>
#   target può essere un singolo IP (es. 192.168.1.10) oppure una rete CIDR (es. 192.168.1.0/24)
#
# Richiede: arp-scan installato, privilegi di rete (root / cap NET_RAW & NET_ADMIN)
# Esempio:
#   sudo ./arp_scan.sh 192.168.1.10
#   sudo ./arp_scan.sh 192.168.1.0/24

set -eu

TARGET="$1"

print_usage() {
  echo "Usage: $0 <ip-or-cidr>"
  echo "  Examples:"
  echo "    $0 192.168.1.10"
  echo "    $0 192.168.1.0/24"
}

if [ -z "$TARGET" ]; then
  print_usage
  exit 1
fi

# semplice validazione IPv4 o CIDR (non esaustiva ma pratica)
is_ipv4() {
  echo "$1" | awk -F'.' 'NF==4{for(i=1;i<=4;i++) if($i<0||$i>255) exit 1; exit 0} {exit 1}'
}

is_cidr() {
  echo "$1" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$'
}

if is_ipv4 "$TARGET"; then
  MODE="ip"
elif is_cidr "$TARGET"; then
  MODE="cidr"
else
  echo "Target non riconosciuto: deve essere un IPv4 (es. 192.168.1.10) o CIDR (es. 192.168.1.0/24)."
  exit 2
fi

# verifica arp-scan
if ! command -v arp-scan >/dev/null 2>&1; then
  echo "arp-scan non trovato. Provo a installare (apt-get)..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y arp-scan || {
      echo "Impossibile installare arp-scan automaticamente. Installa manualmente e riprova."
      exit 3
    }
  else
    echo "Nessun apt-get disponibile nel container. Aggiungi arp-scan al tuo Dockerfile o installalo manualmente."
    exit 3
  fi
fi

# rileva interfaccia di uscita (fallback a eth0 se non trovato)
IFACE=$(ip route get 8.8.8.8 2>/dev/null | awk '/dev/ {print $5; exit}')
if [ -z "$IFACE" ]; then
  IFACE="eth0"
  echo "Impossibile rilevare l'interfaccia automaticamente, userò $IFACE (modifica se necessario)."
fi

# controllo privilegi (non bloccante, solo avviso)
if [ "$(id -u)" -ne 0 ]; then
  echo "ATTENZIONE: non sei root. Potrebbe non essere possibile aprire raw sockets. Esegui con sudo o --cap-add=NET_RAW --cap-add=NET_ADMIN."
fi

echo "Interfaccia scelta: $IFACE"
echo "Target: $TARGET  (modalità: $MODE)"
echo "Eseguo arp-scan..."

# esegui arp-scan: se è ip singolo, lo passi così com'è; se è cidr, idem.
# aggiungo --retry e --timeout per robustezza
set +e
arp-scan --interface="$IFACE" --retry=2 --timeout=200 "$TARGET"
RET=$?
set -e

if [ $RET -ne 0 ]; then
  echo "arp-scan ha restituito codice $RET."
  exit $RET
fi

echo "Scansione completata."
exit 0