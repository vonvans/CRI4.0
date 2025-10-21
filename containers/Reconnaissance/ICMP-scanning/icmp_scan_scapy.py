#!/usr/bin/env python3
"""
icmp_scan_scapy.py
ICMP scanner didattico usando Scapy. USARE SOLO SU RETI DI TEST AUTORIZZATE.

Ora ogni positional arg è un singolo target separato da spazio:
 - singolo IP: 192.168.1.5
 - CIDR: 192.168.1.0/28

Esempi:
  python3 icmp_scan_scapy.py 172.18.0.0/24 10.0.0.5 --timeout 1 --workers 50
  python3 icmp_scan_scapy.py 192.168.1.5 192.168.1.6 10.0.0.0/30 --output results.json
"""
import argparse
import ipaddress
import time
import json
import csv
from concurrent.futures import ThreadPoolExecutor, as_completed
from scapy.all import sr1, IP, ICMP, conf

conf.verb = 0  # silenzia Scapy

def ping_one(target, timeout):
    """
    Invio singolo Echo Request; ritorna dict con risultato e RTT in ms (se presente).
    """
    try:
        t0 = time.time()
        pkt = IP(dst=str(target))/ICMP()
        resp = sr1(pkt, timeout=timeout)
        rtt = None
        if resp is not None:
            # RTT approssimato come tempo trascorso (in ms)
            rtt = (time.time() - t0) * 1000.0
            return {
                "ip": str(target),
                "alive": True,
                "rtt_ms": round(rtt, 2),
                "type": resp.getlayer(ICMP).type if resp.haslayer(ICMP) else None,
                "code": resp.getlayer(ICMP).code if resp.haslayer(ICMP) else None
            }
        else:
            return {"ip": str(target), "alive": False, "rtt_ms": None, "type": None, "code": None}
    except Exception as e:
        return {"ip": str(target), "alive": False, "rtt_ms": None, "error": str(e)}

def expand_target_token(token):
    """
    Espande un singolo token che può essere:
     - singolo IP
     - CIDR
    Ritorna lista di IP strings (hosts only for CIDR).
    Lancia ValueError se il token non è né IP né CIDR valido.
    """
    token = token.strip()
    if not token:
        return []
    # se sembra CIDR (contiene '/'), prova a trattarlo come rete
    if '/' in token:
        net = ipaddress.ip_network(token, strict=False)
        return [str(ip) for ip in net.hosts()]
    else:
        # prova come singolo IP (eccezione se non valido)
        ipaddress.ip_address(token)
        return [str(token)]

def build_targets_from_args(arg_list):
    """
    Arg_list: lista di positional args (ogni elemento è un token, separato da spazi)
    Restituisce lista deduplicata di IP in ordine d'apparizione.
    (NON supporta più target nello stesso arg separati da virgole.)
    """
    seen = set()
    ordered = []
    for raw in arg_list:
        p = str(raw).strip()
        if not p:
            continue
        try:
            ips = expand_target_token(p)
        except Exception as e:
            print(f"⚠️ Skipping invalid token '{p}': {e}")
            continue
        for ip in ips:
            if ip not in seen:
                seen.add(ip)
                ordered.append(ip)
    return ordered

def main():
    p = argparse.ArgumentParser(description="ICMP scanner con Scapy - USO DIDATTICO SOLO IN RETI AUTORIZZATE")
    p.add_argument("targets", nargs='+', help="Uno o più target (IP o CIDR), separati da spazi.")
    p.add_argument("--timeout", type=float, default=1.0, help="timeout per ping (s)")
    p.add_argument("--workers", type=int, default=50, help="numero di thread concorrenti")
    p.add_argument("--output", help="file di output (json o csv). Es: results.json o results.csv")
    p.add_argument("--verbose", action="store_true", help="stampa output dettagliato")
    args = p.parse_args()

    print("DISCLAIMER: eseguire solo su reti di test o con autorizzazione. Scansione in corso...")
    targets = build_targets_from_args(args.targets)
    if not targets:
        print("Nessun target valido fornito. Uscita.")
        return

    print(f"Targets risolti ({len(targets)}):")
    for t in targets:
        print("  -", t)

    results = []
    start = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        future_to_ip = {ex.submit(ping_one, ip, args.timeout): ip for ip in targets}
        for fut in as_completed(future_to_ip):
            ip = future_to_ip[fut]
            try:
                res = fut.result()
            except Exception as e:
                res = {"ip": ip, "alive": False, "rtt_ms": None, "error": str(e)}
            results.append(res)
            if args.verbose:
                if res.get("alive"):
                    print(f"{res['ip']} UP  RTT={res['rtt_ms']} ms")
                else:
                    print(f"{res['ip']} DOWN")

    elapsed = time.time() - start
    up_count = sum(1 for r in results if r.get("alive"))
    print(f"\nScansione completata: {len(results)} host - {up_count} UP - tempo {elapsed:.2f}s")

    if args.output:
        if args.output.lower().endswith(".json"):
            with open(args.output, "w") as f:
                json.dump(results, f, indent=2)
            print("Risultati salvati su", args.output)
        elif args.output.lower().endswith(".csv"):
            keys = ["ip", "alive", "rtt_ms", "type", "code", "error"]
            with open(args.output, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                for r in results:
                    writer.writerow({k: r.get(k) for k in keys})
            print("Risultati salvati su", args.output)
        else:
            print("Formato output non supportato (usa .json o .csv)")

if __name__ == "__main__":
    main()