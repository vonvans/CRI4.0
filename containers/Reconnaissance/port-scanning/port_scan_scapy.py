#!/usr/bin/env python3
"""
port_scan_scapy.py
Port scanner didattico usando Scapy.

Ora richiede che le opzioni (es. -p/--ports, --udp, --timeout, --workers, --output)
siano specificate **prima** dei target posizionali (IP o CIDR).

Esempi corretti:
  python3 port_scan_scapy.py -p 22,80,443 192.168.10.5
  python3 port_scan_scapy.py --udp -p 53 10.0.0.0/30
  python3 port_scan_scapy.py -p 1-1024 --workers 200 172.18.0.5

Se l'ordine non è rispettato (es. `port_scan_scapy.py 192.168.10.5 -p 22`),
lo script terminerà con errore invitandoti a correggere.
"""
import argparse
import ipaddress
import time
import json
import csv
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from scapy.all import IP, TCP, UDP, ICMP, sr1, send, conf
import os, importlib, smoloki




conf.verb = 0

# ---------- utilities ----------
def parse_ports(port_spec: str):
    ports = set()
    for token in port_spec.split(','):
        token = token.strip()
        if not token:
            continue
        if '-' in token:
            a, b = token.split('-', 1)
            a, b = int(a), int(b)
            if a > b: a, b = b, a
            ports.update(range(a, b+1))
        else:
            ports.add(int(token))
    return sorted(p for p in ports if 0 < p < 65536)

def expand_targets(args_list):
    seen = set()
    ordered = []
    for raw in args_list:
        raw = raw.strip()
        if not raw:
            continue
        if '/' in raw:
            net = ipaddress.ip_network(raw, strict=False)
            for ip in net.hosts():
                s = str(ip)
                if s not in seen:
                    seen.add(s); ordered.append(s)
        else:
            ipaddress.ip_address(raw)  # validate (raises if invalid)
            if raw not in seen:
                seen.add(raw); ordered.append(raw)
    return ordered

# ---------- scan primitives ----------
def tcp_syn_scan(target_ip: str, port: int, timeout: float):
    pkt = IP(dst=target_ip)/TCP(dport=port, flags="S")
    resp = sr1(pkt, timeout=timeout)
    if resp is None:
        return {"ip": target_ip, "port": port, "proto": "TCP", "state": "filtered", "info": None}
    if resp.haslayer(TCP):
        t = resp.getlayer(TCP)
        flags = int(t.flags)
        if flags & 0x12 == 0x12:
            send(IP(dst=target_ip)/TCP(dport=port, flags="R"), verbose=0)
            return {"ip": target_ip, "port": port, "proto": "TCP", "state": "open", "info": None}
        if flags & 0x14:
            return {"ip": target_ip, "port": port, "proto": "TCP", "state": "closed", "info": None}
    return {"ip": target_ip, "port": port, "proto": "TCP", "state": "unknown", "info": str(resp.summary())}

def udp_scan(target_ip: str, port: int, timeout: float):
    pkt = IP(dst=target_ip)/UDP(dport=port)
    resp = sr1(pkt, timeout=timeout)
    if resp is None:
        return {"ip": target_ip, "port": port, "proto": "UDP", "state": "open|filtered", "info": None}
    if resp.haslayer(ICMP):
        ic = resp.getlayer(ICMP)
        if int(ic.type) == 3 and int(ic.code) == 3:
            return {"ip": target_ip, "port": port, "proto": "UDP", "state": "closed", "info": None}
        return {"ip": target_ip, "port": port, "proto": "UDP", "state": "filtered", "info": f"icmp {ic.type}/{ic.code}"}
    if resp.haslayer(UDP):
        return {"ip": target_ip, "port": port, "proto": "UDP", "state": "open", "info": None}
    return {"ip": target_ip, "port": port, "proto": "UDP", "state": "unknown", "info": str(resp.summary())}

def scan_worker(task):
    target_ip, port, mode, timeout = task
    try:
        if mode == "tcp":
            return tcp_syn_scan(target_ip, port, timeout)
        else:
            return udp_scan(target_ip, port, timeout)
    except Exception as e:
        return {"ip": target_ip, "port": port, "proto": mode.upper(), "state": "error", "info": str(e)}

# ---------- CLI order enforcement ----------
def ensure_ports_before_targets():
    """
    Verifica che l'opzione -p/--ports compaia **prima** del primo target posizionale
    nella linea di comando; se no esce con codice 2 e mostra istruzioni.
    """
    argv = sys.argv[1:]  # exclude script name
    if not argv:
        return  # will be handled by argparse later

    # trova indice primo token che non sia un option (non comincia con '-')
    first_pos_index = None
    for idx, tok in enumerate(argv):
        if not tok.startswith('-'):
            first_pos_index = idx
            break

    # trova indice della flag -p o --ports (supporta anche --ports=...)
    port_index = None
    for idx, tok in enumerate(argv):
        if tok == '-p' or tok == '--ports' or tok.startswith('--ports=') or (tok.startswith('-p') and tok != '-p'):
            port_index = idx
            break

    # se non troviamo il flag delle porte, argparse gestirà la mancanza (è required)
    if port_index is None:
        return

    # se non ci sono posizionali prima del flag, OK
    if first_pos_index is None:
        return

    # se il port_index è >= first_pos_index => l'utente ha scritto un posizionale PRIMA di -p -> rifiuta
    if port_index >= first_pos_index:
        sys.stderr.write("\nErrore: le opzioni devono venire PRIMA dei target posizionali.\n")
        sys.stderr.write("Sintassi richiesta: port_scan_scapy.py -p <ports> [--udp] [--timeout X] [--workers N] <target1> <target2> ...\n")
        sys.stderr.write("Esempio corretto:\n  port_scan_scapy.py -p 22,80,443 192.168.10.5 10.0.0.0/30\n\n")
        sys.exit(2)

# ---------- main ----------
def main():
    # enforce order BEFORE argparse processes (so we can show clear error)
    ensure_ports_before_targets()

    p = argparse.ArgumentParser(description="Port scanner con Scapy (TCP SYN / UDP) - USO DIDATTICO")
    p.add_argument("-p", "--ports", required=True, help="Porte: es. 22,80,443 o 1-1024 o mix '22,80,100-200'")
    p.add_argument("--udp", action="store_true", help="Usa UDP scan invece di TCP SYN")
    p.add_argument("--timeout", type=float, default=1.0, help="Timeout per probe (s)")
    p.add_argument("--workers", type=int, default=200, help="Numero massimo di worker concorrenti")
    p.add_argument("--output", help="File output (.json o .csv)")
    p.add_argument("--verbose", action="store_true")
    p.add_argument("targets", nargs='+', help="IP o CIDR (separati da spazi). Esempio: 192.168.0.1 10.0.0.0/30")
    args = p.parse_args()

    os.environ["SMOLOKI_BASE_ENDPOINT"] = "http://10.1.0.254:3100"
    importlib.reload(smoloki)
    
    smoloki.push_sync(
        {"job": "port_scan", "level": "info"},
        {"message": "Start port scan attack"}
    )

    try:
        targets = expand_targets(args.targets)
    except Exception as e:
        print("Errore parsing targets:", e); return
    ports = parse_ports(args.ports)
    if not targets:
        print("Nessun target valido."); return
    if not ports:
        print("Nessuna porta valida."); return

    mode = "udp" if args.udp else "tcp"
    print(f"Scan mode: {mode.upper()} | targets: {len(targets)} | ports: {len(ports)} | workers: {args.workers}")
    output_message=""

    tasks = []
    for t in targets:
        for pr in ports:
            tasks.append((t, pr, mode, args.timeout))

    results = []
    start = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(scan_worker, task): task for task in tasks}
        for fut in as_completed(futures):
            res = fut.result()
            results.append(res)
            if args.verbose:
                print(f"{res['ip']}:{res['port']}/{res['proto']} -> {res['state']} {('('+str(res['info'])+')') if res.get('info') else ''}")

    elapsed = time.time() - start
    print(f"\nScan completed: {len(tasks)} probes in {elapsed:.2f}s; results: {len(results)}")
    open_ports = [r for r in results if r['state'] in ('open', 'open|filtered')]
    print(f"Potential open/open|filtered ports: {len(open_ports)}")

    for port in open_ports:
        output_message+=(f"{port['ip']}:{port['port']}/{port['proto']} -> {port['state']} {('('+str(port['info'])+')') if port.get('info') else ''}")
    
    smoloki.push_sync(
        {"job": "port_scan", "level": "info"},
        {"message": output_message}
    )
    if args.output:
        if args.output.lower().endswith(".json"):
            with open(args.output, "w") as f:
                json.dump(results, f, indent=2)
            print("Saved JSON to", args.output)
        elif args.output.lower().endswith(".csv"):
            keys = ["ip","port","proto","state","info"]
            with open(args.output, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                for r in results:
                    writer.writerow({k: r.get(k) for k in keys})
            print("Saved CSV to", args.output)
        else:
            print("Output format not supported (use .json or .csv)")

if __name__ == "__main__":
    main()