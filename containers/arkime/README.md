# Arkime (traffic analysis)

Full-packet capture and search for a running CRI4.0 lab, embedded in the UI
(the **Statistics** tab shows the Arkime home; right-click a machine →
**Net Flow** opens its sessions filtered by IP).

Unlike the podman workflow this integration is based on, capture is **not** done
on a single host interface. The Kathara lab links (`10.x`) live in userspace VDE
switches and are invisible on the host, so a host-side capture would only see
management traffic (`172.17.x`). Instead CRI4.0 runs **one capture per machine
inside that machine's network namespace** — see `src/shared/arkime.ts`.

## Runtime shape (all orchestrated by `src/shared/arkime.ts`)

Started automatically when a simulation starts, torn down when it stops:

- **`cri40-arkime-opensearch`** — OpenSearch single-node, host networking,
  the index/search backend (`:9200`).
- **`cri40-arkime-viewer`** — Arkime viewer, host networking, the web UI
  (`:8005`) embedded in the CRI4.0 modals. Reads SPI/sessions from OpenSearch.
- **`cri40-arkime-cap-<machine>`** (one per lab machine) — Arkime capture run
  with `docker run --net=container:<kathara_container>`, so it shares the
  machine's netns and sniffs `-i any`. Writes pcap to the shared `raw/` volume
  and indexes into OpenSearch (reached via the docker0 gateway `172.17.0.1`).

Config lives under `~/.cri40/arkime/{etc,raw}` (generated from `config.ini`
here). Once the viewer is up, a `ready` line is pushed to Loki (the collector)
so it shows up like the other machines.

## Notes / limitations

- **Sessions, SPI and statistics work fully** (the viewer reads them from
  OpenSearch). Opening a session's **raw packets** may fail: with multiple
  capture nodes on one host the viewer cannot always proxy back to the node that
  wrote the pcap. This is fine for flow/connection inspection.
- The `interface=any` capture uses `pcapReadMethod=libpcap` (tpacketv3 does not
  support the `any` pseudo-interface).
