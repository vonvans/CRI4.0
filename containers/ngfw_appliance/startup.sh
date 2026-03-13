modprobe nfnetlink_queue
nft add table inet filter
service suricata start
yq eval '(.outputs[] | select(has("pcap-log")).pcap-log) |= (.enabled = "yes" | .mode = "normal" | .limit = "1000mb")' -i /etc/suricata/suricata.yaml
