#!/usr/bin/env python3
"""
os_fingerprint_scapy.py
OS fingerprinting didattico usando Scapy. USARE SOLO SU RETI DI TEST AUTORIZZATE.

Uso:
  python3 os_fingerprint_scapy.py 192.168.10.5 172.18.0.0/30 --timeout 1 --workers 40 --output results.json

Ogni positional arg è un singolo target (IP o CIDR), separati da spazi.
"""
import argparse
import ipaddress
import time
import json
import csv
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from scapy.all import IP, TCP, UDP, ICMP, sr1, sr, conf, Raw, send

conf.verb = 0  # silenzia Scapy

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
            ipaddress.ip_address(raw)  # validate (raises if invalid)
            if raw not in seen:
                seen.add(raw); ordered.append(raw)
    return ordered

def safe_sr1(pkt, timeout):
    try:
        return sr1(pkt, timeout=timeout)
    except Exception as e:
        return None

# ---------- probes ----------
def probe_tcp_syn(target, port, timeout, options=None):
    """
    SYN probe to given port. options: list of tuples for TCP options (Scapy).
    """
    if options is None:
        pkt = IP(dst=target)/TCP(dport=port, flags="S")
    else:
        pkt = IP(dst=target)/TCP(dport=port, flags="S", options=options)
    return safe_sr1(pkt, timeout)

def probe_null(target, timeout):
    return safe_sr1(IP(dst=target)/TCP(dport=65535, flags=""), timeout)

def probe_fin(target, timeout):
    return safe_sr1(IP(dst=target)/TCP(dport=65535, flags="F"), timeout)

def probe_xmas(target, timeout):
    return safe_sr1(IP(dst=target)/TCP(dport=65535, flags="FPU"), timeout)  # FIN+PSH+URG

def probe_ack(target, timeout):
    return safe_sr1(IP(dst=target)/TCP(dport=65535, flags="A"), timeout)

def probe_icmp_echo(target, timeout):
    return safe_sr1(IP(dst=target)/ICMP(), timeout)

def probe_udp(target, port, timeout):
    return safe_sr1(IP(dst=target)/UDP(dport=port), timeout)

# ---------- analysis ----------
def extract_tcp_info(resp):
    info = {}
    try:
        info['ttl'] = int(resp[IP].ttl)
    except Exception:
        info['ttl'] = None
    try:
        if resp.haslayer(TCP):
            t = resp.getlayer(TCP)
            info['tcp_flags'] = int(t.flags)
            info['tcp_window'] = int(t.window)
            # options come as list of tuples: [('MSS',1460), ('SAckOK','')...]
            opts = getattr(t, "options", None)
            if opts:
                # map to simple list of option names and values
                info['tcp_options'] = [ (o if isinstance(o, tuple) and len(o)>0 else o) for o in opts ]
            else:
                info['tcp_options'] = []
        else:
            info['tcp_flags'] = None
            info['tcp_window'] = None
            info['tcp_options'] = []
    except Exception:
        info['tcp_flags'] = None
        info['tcp_window'] = None
        info['tcp_options'] = []
    return info

def extract_icmp_info(resp):
    info = {}
    try:
        info['ttl'] = int(resp[IP].ttl)
    except Exception:
        info['ttl'] = None
    try:
        if resp.haslayer(ICMP):
            ic = resp.getlayer(ICMP)
            info['icmp_type'] = int(ic.type)
            info['icmp_code'] = int(ic.code)
        else:
            info['icmp_type'] = None
            info['icmp_code'] = None
    except Exception:
        info['icmp_type'] = None
        info['icmp_code'] = None
    return info

def heuristics_from_observations(obs):
    """
    obs: dict con risultati delle varie probe (raw fields).
    ritorna una stringa 'os_guess' e 'reason' (spiegazione sommaria).
    Questa è una semplice euristica didattica, non esaustiva.
    """
    # raccogli campi utili
    ttl_candidates = []
    win_candidates = []
    opts_candidates = []

    for k,v in obs.items():
        if v is None:
            continue
        if k.startswith("syn_") or k.startswith("syn_closed_") or k.startswith("null_") or k.startswith("fin_") or k.startswith("xmas_") or k.startswith("ack_"):
            info = v.get('info',{})
            ttl = info.get('ttl')
            win = info.get('tcp_window')
            opts = info.get('tcp_options', [])
            if ttl: ttl_candidates.append(ttl)
            if win: win_candidates.append(win)
            if opts: opts_candidates.append([o[0] if isinstance(o, tuple) and len(o)>0 else o for o in opts])
        if k.startswith("icmp_"):
            icmp = v.get('info', {})
            if icmp.get('ttl'): ttl_candidates.append(icmp.get('ttl'))

    # default unknown
    guess = "unknown"
    reason = []

    # choose representative ttl (most common / first)
    rep_ttl = ttl_candidates[0] if ttl_candidates else None
    rep_win = win_candidates[0] if win_candidates else None

    # heuristics (very approximate)
    if rep_ttl is not None:
        if rep_ttl >= 120 and rep_ttl <= 130:
            reason.append(f"Observed TTL ~{rep_ttl} (typical Windows defaults)")
            guess = "Windows (likely)"
        elif rep_ttl >= 50 and rep_ttl <= 80:
            reason.append(f"Observed TTL ~{rep_ttl} (typical Linux/Unix/BSD defaults)")
            guess = "Linux/Unix-like (likely)"
        elif rep_ttl >= 200:
            reason.append(f"Observed TTL ~{rep_ttl} (typical network appliance/embedded)")
            guess = "Network appliance / Embedded (possible)"
        else:
            reason.append(f"Observed TTL {rep_ttl} ambiguous")

    # look at window sizes and tcp options for extra hints
    if rep_win:
        if rep_win >= 60000:
            reason.append(f"Large TCP window {rep_win} often seen on Windows stacks")
            if guess == "unknown":
                guess = "Windows (likely)"
        elif rep_win in (5840, 14600, 29200) or (20000 < rep_win < 40000):
            reason.append(f"TCP window {rep_win} often seen on Linux variants")
            if guess == "unknown":
                guess = "Linux/Unix-like (likely)"
        else:
            reason.append(f"TCP window {rep_win} unusual/ambiguous")

    # check TCP options patterns (presence/order)
    # common patterns: many BSD/Linux include TS + SACKOK + WScale; some embedded omit TS
    # This is coarse: check for timestamp presence
    ts_present = any(('TS' in (opt if isinstance(opt,str) else opt[0]) if opt else False) for l in opts_candidates for opt in l)
    sack_present = any(('SAckOK' in (opt if isinstance(opt,str) else opt[0]) if opt else False) for l in opts_candidates for opt in l)
    if ts_present and sack_present:
        reason.append("TCP options include TS and SACKOK (common on modern Unix/Linux/BSD)")
        if guess == "unknown":
            guess = "Unix/Linux/BSD (likely)"
    elif not ts_present and rep_ttl and rep_ttl > 200:
        reason.append("No TCP timestamps and high TTL -> could be embedded/router")
        if guess == "unknown":
            guess = "Embedded / Network device (possible)"

    # final fallback: if no data
    if guess == "unknown":
        reason.append("Insufficient/ambiguous data for confident guess")

    return {"os_guess": guess, "reason": "; ".join(reason)}

# ---------- per-target routine ----------
def fingerprint_target(target, timeout):
    """
    Esegue una serie di probe sul target e ritorna un report.
    """
    report = {"target": target, "timestamp": time.time(), "probes": {}, "heuristic": None}

    # 1) SYN to common port (80)
    r_syn_80 = probe_tcp_syn(target, 80, timeout,
                             options=[('MSS',1460), ('SAckOK',''), ('TS',(int(time.time()),0)), ('WScale',10)])
    report['probes']['syn_80'] = {"raw": str(r_syn_80.summary()) if r_syn_80 else None, "info": extract_tcp_info(r_syn_80) if r_syn_80 else {}}

    # 2) SYN to likely-closed port (65535) to provoke RST from closed stack
    r_syn_closed = probe_tcp_syn(target, 65535, timeout,
                                 options=[('MSS',1460), ('SAckOK','')])
    report['probes']['syn_closed_65535'] = {"raw": str(r_syn_closed.summary()) if r_syn_closed else None, "info": extract_tcp_info(r_syn_closed) if r_syn_closed else {}}

    # 3) NULL/FIN/XMAS/ACK probes to see RST/response behavior
    r_null = probe_null(target, timeout)
    report['probes']['null_65535'] = {"raw": str(r_null.summary()) if r_null else None, "info": extract_tcp_info(r_null) if r_null else {}}

    r_fin = probe_fin(target, timeout)
    report['probes']['fin_65535'] = {"raw": str(r_fin.summary()) if r_fin else None, "info": extract_tcp_info(r_fin) if r_fin else {}}

    r_xmas = probe_xmas(target, timeout)
    report['probes']['xmas_65535'] = {"raw": str(r_xmas.summary()) if r_xmas else None, "info": extract_tcp_info(r_xmas) if r_xmas else {}}

    r_ack = probe_ack(target, timeout)
    report['probes']['ack_65535'] = {"raw": str(r_ack.summary()) if r_ack else None, "info": extract_tcp_info(r_ack) if r_ack else {}}

    # 4) ICMP echo (if allowed)
    r_icmp = probe_icmp_echo(target, timeout)
    report['probes']['icmp_echo'] = {"raw": str(r_icmp.summary()) if r_icmp else None, "info": extract_icmp_info(r_icmp) if r_icmp else {}}

    # 5) UDP probe on port 53 (DNS) as UDP behaviour
    r_udp_53 = probe_udp(target, 53, timeout)
    report['probes']['udp_53'] = {"raw": str(r_udp_53.summary()) if r_udp_53 else None, "info": extract_icmp_info(r_udp_53) if r_udp_53 else {}}

    # analyse heuristics
    report['heuristic'] = heuristics_from_observations(report['probes'])
    return report

# ---------- worker ----------
def scan_worker(task):
    t, timeout = task
    try:
        return fingerprint_target(t, timeout)
    except Exception as e:
        return {"target": t, "error": str(e)}

# ---------- CLI ----------
def main():
    p = argparse.ArgumentParser(description="OS fingerprinting didattico con Scapy - USO DIDATTICO")
    p.add_argument("targets", nargs='+', help="Uno o più target (IP o CIDR), separati da spazi.")
    p.add_argument("--timeout", type=float, default=1.0, help="timeout per singola probe (s)")
    p.add_argument("--workers", type=int, default=50, help="numero di worker concorrenti")
    p.add_argument("--output", help="file di output (json o csv)")
    p.add_argument("--verbose", action="store_true")
    args = p.parse_args()

    targets = expand_targets(args.targets)
    if not targets:
        print("Nessun target valido fornito. Uscita.")
        return

    if args.verbose:
        print("Targets:", targets)

    results = []
    start = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(scan_worker, (t, args.timeout)): t for t in targets}
        for fut in as_completed(futures):
            res = fut.result()
            results.append(res)
            if args.verbose:
                print(json.dumps(res, indent=2))

    elapsed = time.time() - start

    # Stampa compatta per ogni IP quando NON è attivo --verbose
    if not args.verbose:
        for r in results:
            tgt = r.get('target') or r.get('ip') or "<unknown>"
            heur = r.get('heuristic') or {}
            os_guess = heur.get('os_guess', 'unknown')
            reason = heur.get('reason', '')
            if reason:
                print(f"{tgt}  -> {os_guess}  -- reason: {reason}")
            else:
                print(f"{tgt}  -> {os_guess}")
    else:
        print(f"\nFingerprinting completata: {len(results)} target in {elapsed:.2f}s")

    if args.output:
        if args.output.lower().endswith(".json"):
            with open(args.output, "w") as f:
                json.dump(results, f, indent=2)
            print("Risultati salvati su", args.output)
        elif args.output.lower().endswith(".csv"):
            # CSV: una riga per target, store JSON nella colonna 'report'
            with open(args.output, "w", newline="") as f:
                fieldnames = ['target', 'report_json']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for r in results:
                    writer.writerow({'target': r.get('target'), 'report_json': json.dumps(r)})
            print("Risultati salvati su", args.output)
        else:
            print("Formato output non supportato (usa .json o .csv)")

if __name__ == "__main__":
    main()