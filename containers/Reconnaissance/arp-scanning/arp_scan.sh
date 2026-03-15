#!/bin/sh
# arp_scan.sh
# Uso:
#   ./arp_scan.sh <target1> [<target2> ...]
#   ./arp_scan.sh 192.168.1.10 192.168.1.0/24
#   ./arp_scan.sh "192.168.1.10,192.168.1.11,192.168.1.20/30"
#   ./arp_scan.sh @targets.txt        # file con un target per riga o separati da virgola
#
# Richiede: arp-scan installato, privilegi di rete (root / cap NET_RAW & NET_ADMIN)
# Esempio:
#   sudo ./arp_scan.sh 192.168.1.10 192.168.1.0/24

set -eu

print_usage() {
  echo "Usage: $0 <ip-or-cidr> [<ip-or-cidr> ...]"
  echo "  - Ogni arg può essere singolo IP, CIDR, o lista separata da virgole."
  echo "  - Puoi passare @file per leggere targets da file (uno per riga o virgole)."
  echo "Examples:"
  echo "  $0 192.168.1.10 192.168.1.0/24"
  echo "  $0 \"192.168.1.10,192.168.1.11\""
  echo "  $0 @targets.txt"
}

# Se nessun arg, mostra help
if [ "$#" -lt 1 ]; then
  print_usage
  exit 1
fi

#Push 'start attack' message to collector
export SMOLOKI_BASE_ENDPOINT="http://10.1.0.254:3100"
smoloki '{"job":"arp_scan","level":"info"}' '{"message":"Start arp scan attack"}'

# Funzioni di validazione (semplici, pratiche)
is_ipv4() {
  echo "$1" | awk -F'.' 'NF==4{for(i=1;i<=4;i++) if($i<0||$i>255) exit 1; exit 0} {exit 1}'
}

is_cidr() {
  echo "$1" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$'
}

# Costruisci lista targets da args (supporta virgole e @file)
TARGETS_RAW=""
for a in "$@"; do
  if echo "$a" | grep -q '^@'; then
    f="${a#@}"
    if [ ! -f "$f" ]; then
      echo "File non trovato: $f" >&2
      exit 2
    fi
    # leggi file, sostituisci virgole con newline, rimuovi righe vuote e commenti
    file_content=$(sed -e 's/,/\n/g' "$f" | sed -e 's/#.*//' | sed -e '/^[[:space:]]*$/d')
    TARGETS_RAW="${TARGETS_RAW}
${file_content}"
  else
    # sostituisci virgole con newline e append
    replaced=$(echo "$a" | sed 's/,/\
/g')
    TARGETS_RAW="${TARGETS_RAW}
${replaced}"
  fi
done

# Normalizza in array (rimuove spazi)
TARGETS=""
for t in $(echo "$TARGETS_RAW" | sed '/^[[:space:]]*$/d'); do
  # trim spazi
  tt=$(echo "$t" | awk '{$1=$1;print}')
  if [ -n "$tt" ]; then
    TARGETS="${TARGETS}
${tt}"
  fi
done

# Se non ci sono targets validi
if [ -z "$(echo "$TARGETS" | sed '/^[[:space:]]*$/d')" ]; then
  echo "Nessun target valido trovato."
  exit 1
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
    echo "Nessun apt-get disponibile. Aggiungi arp-scan al tuo Dockerfile o installalo manualmente."
    exit 3
  fi
fi

# rileva interfaccia di uscita (fallback a eth0 se non trovato)
IFACE=$(ip route get 8.8.8.8 2>/dev/null | awk '/dev/ {print $5; exit}')
if [ -z "$IFACE" ]; then
  IFACE="eth0"
  echo "Impossibile rilevare l'interfaccia automaticamente, userò $IFACE (modifica se necessario)."
fi

# controllo privilegi (solo avviso)
if [ "$(id -u)" -ne 0 ]; then
  echo "ATTENZIONE: non sei root. Potrebbe non essere possibile aprire raw sockets. Esegui con sudo o --cap-add=NET_RAW --cap-add=NET_ADMIN."
fi

echo "Interfaccia scelta: $IFACE"
echo "Targets trovati:"
echo "$TARGETS" | sed '/^[[:space:]]*$/d' | sed 's/^/  - /'

echo
echo "Eseguo arp-scan per ogni target..."

# track failures
FAIL=0

# loop su targets (elimina duplicati semplici)
for target in $(echo "$TARGETS" | sed '/^[[:space:]]*$/d' | awk '!seen[$0]++{print $0}'); do
  # valida target
  if is_ipv4 "$target" || is_cidr "$target"; then
    echo "----------------------------------------"
    echo "Target: $target"
    echo "----------------------------------------"
    # esegui arp-scan (non interrompere lo script se fallisce per uno specifico target)
    set +e
    arp-scan --interface="$IFACE" --retry=2 --timeout=200 "$target"
    rc=$?
    set -e
    if [ $rc -ne 0 ]; then
      echo "arp-scan su $target ha restituito codice $rc." >&2
      FAIL=1
    else
      echo "Scansione $target completata con successo."
    fi
    echo
  else
    echo "Target ignorato (formato non riconosciuto): $target" >&2
    FAIL=1
  fi
done

if [ $FAIL -ne 0 ]; then
  echo "Almeno una scansione è fallita o alcuni target erano non validi." >&2
  exit 1
fi

echo "Tutte le scansioni completate con successo."
exit 0