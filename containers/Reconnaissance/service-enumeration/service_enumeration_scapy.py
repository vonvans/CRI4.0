#!/usr/bin/env python3
"""
service_enumeration_scapy.py
Service enumeration didattico usando Scapy + banner grab (socket).
USARE SOLO SU RETI DI TEST AUTORIZZATE.

Esempi:
  python3 service_enumeration_scapy.py 192.168.10.5 --ports 22,80,502 --workers 100
  python3 service_enumeration_scapy.py 172.18.0.0/24 --ports 22,80,443,502 --output results.json
"""
import argparse
import ipaddress
import time
import json
import csv
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from scapy.all import IP, TCP, sr1, conf

conf.verb = 0

# ---------- utilities ----------
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
            ipaddress.ip_address(raw)  # validate
            if raw not in seen:
                seen.add(raw); ordered.append(raw)
    return ordered

def parse_ports(port_spec):
    """
    Accetta stringhe come "22,80,100-110" e ritorna lista ordinata di porte uniche.
    """
    if not port_spec:
        return []
    parts = [p.strip() for p in port_spec.split(',') if p.strip()]
    ports = set()
    for p in parts:
        if '-' in p:
            a,b = p.split('-',1)
            a = int(a); b = int(b)
            if a > b: a,b = b,a
            for x in range(a, b+1):
                if 1 <= x <= 65535: ports.add(x)
        else:
            v = int(p)
            if 1 <= v <= 65535: ports.add(v)
    return sorted(ports)

# ---------- network primitives ----------
def syn_probe(target, port, timeout):
    """
    SYN probe: invia SYN e aspetta risposta.
    Restituisce: 'open' (SYN-ACK), 'closed' (RST), 'filtered' (no reply), or None on error.
    Also returns raw response object for extracting TTL/window/options if needed.
    """
    try:
        pkt = IP(dst=target)/TCP(dport=port, flags="S")
        resp = sr1(pkt, timeout=timeout)
        if resp is None:
            return ("filtered", None)
        if resp.haslayer(TCP):
            t = resp.getlayer(TCP)
            flags = int(t.flags)
            # SYN-ACK -> open
            if flags & 0x12 == 0x12:
                # send RST to close handshake politely
                try:
                    rst = IP(dst=target)/TCP(dport=port, flags="R", seq=t.ack)
                    # non attendiamo risposta
                    from scapy.all import send
                    send(rst, verbose=0)
                except Exception:
                    pass
                return ("open", resp)
            # RST -> closed
            if flags & 0x14:
                return ("closed", resp)
        # otherwise unknown
        return ("unknown", resp)
    except Exception:
        return (None, None)

def banner_grab_tcp(target, port, banner_timeout):
    """
    Apertura socket TCP standard per ricevere banner. Non invia payload,
    ma può inviare un byte nullo se necessario. Ritorna stringa banner (str) o ''.
    """
    try:
        with socket.create_connection((target, port), timeout=banner_timeout) as s:
            s.settimeout(banner_timeout)
            try:
                data = s.recv(4096)
                if not data:
                    return ""
                try:
                    return data.decode('utf-8', errors='replace').strip()
                except Exception:
                    return repr(data)
            except socket.timeout:
                return ""
    except Exception:
        return ""

# ---------- worker ----------
def enumerate_target_port(task):
    target, port, timeout, banner_timeout = task
    status, resp = syn_probe(target, port, timeout)
    result = {"port": port, "status": status, "banner": None}
    if status == "open":
        # attempt banner grab (non-intrusive)
        banner = banner_grab_tcp(target, port, banner_timeout)
        result["banner"] = banner
    return (target, result)

# ---------- CLI ----------
def main():
    p = argparse.ArgumentParser(description="Service enumeration didattico (Scapy SYN + banner grab). USO DIDATTICO")
    p.add_argument("targets", nargs='+', help="IP o CIDR separati da spazi")
    p.add_argument("--ports", default="22,23,80,443,502,102,2404,44818,20000", help="Lista porte CSV o range es: 22,80,100-110")
    p.add_argument("--timeout", type=float, default=1.0, help="timeout per probe SYN (s)")
    p.add_argument("--banner-timeout", type=float, default=1.0, help="timeout per banner grab (s)")
    p.add_argument("--workers", type=int, default=100, help="numero max worker concorrenti")
    p.add_argument("--output", help="file output (.json or .csv)")
    p.add_argument("--verbose", action="store_true", help="stampa dettagli per debug")
    args = p.parse_args()

    targets = expand_targets(args.targets)
    if not targets:
        print("Nessun target valido. Uscita.")
        return

    ports = parse_ports(args.ports)
    if not ports:
        print("Nessuna porta valida. Uscita.")
        return

    # build tasks
    tasks = []
    for t in targets:
        for pport in ports:
            tasks.append( (t, pport, args.timeout, args.banner_timeout) )

    results_map = { t: [] for t in targets }

    start = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = { ex.submit(enumerate_target_port, task): task for task in tasks }
        for fut in as_completed(futures):
            try:
                target, tres = fut.result()
            except Exception as e:
                # log error and continue
                if args.verbose:
                    print("Worker error:", e)
                continue
            results_map[target].append(tres)
            if args.verbose:
                print(f"[{target}] port {tres['port']} -> {tres['status']} banner='{(tres['banner'] or '')[:120]}'")

    elapsed = time.time() - start

    # compact output: per target list open ports + banner short
    compact = []
    for t in targets:
        open_ports = [ r for r in sorted(results_map.get(t, []), key=lambda x: x['port']) if r['status'] == 'open' ]
        compact_entry = {"target": t, "open_ports": []}
        for r in open_ports:
            banner = r.get('banner') or ""
            compact_entry["open_ports"].append( {"port": r['port'], "banner": banner} )
        compact.append(compact_entry)
        if not args.verbose:
            if compact_entry["open_ports"]:
                banners_preview = ", ".join([ f"{e['port']}[{(e['banner'] or '')[:60].replace('\\n',' ')}]" for e in compact_entry["open_ports"] ])
                print(f"{t} -> open: {banners_preview}")
            else:
                print(f"{t} -> no open ports (from scanned set)")

    if args.verbose:
        print(f"\nEnumeration completed: {len(targets)} targets, elapsed {elapsed:.2f}s")

    # output to file if requested
    if args.output:
        if args.output.lower().endswith(".json"):
            with open(args.output, "w") as f:
                json.dump(compact, f, indent=2)
            print("Results saved to", args.output)
        elif args.output.lower().endswith(".csv"):
            with open(args.output, "w", newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(["target", "open_ports_json"])
                for c in compact:
                    writer.writerow([c['target'], json.dumps(c['open_ports'], ensure_ascii=False)])
            print("Results saved to", args.output)
        else:
            print("Output format not supported (use .json or .csv)")

if __name__ == "__main__":
    main()