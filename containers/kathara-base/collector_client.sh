while true; do
    # TODO GET STATS SOURCE FROM /proc
    # MOVE AWAY FROM BASH

    hostname=$(hostname)
    timestamp=$(date +%s)

    cpu_last1min=$(uptime | xargs | awk -F ' ' '{printf $(NF-2)}' | tr -d ",")
    cpu_last5min=$(uptime | xargs | awk -F ' ' '{printf $(NF-1)}' | tr -d ",")
    cpu_last15min=$(uptime | xargs | awk -F ' ' '{printf $(NF)}' | tr -d ",")

    ram_total=$(free | tail -n 2 | head -n 1 | xargs | cut -d " " -f 2)
    ram_used=$(free | tail -n 2 | head -n 1 | xargs | cut -d " " -f 3)
    ram_free=$(free | tail -n 2 | head -n 1 | xargs | cut -d " " -f 4)
    ram_available=$(free | tail -n 2 | head -n 1 | xargs | cut -d " " -f 7)

    # TODO GET NETWORK STATS
    pkt_received=$(echo 0)
    pkt_sent=$(echo 0)

    # TODO GET IO STATS
    io_read=$(echo 0)
    io_write=$(echo 0)

    curl \
    --header 'Content-Type: application/json' \
    --request POST \
    --data "{
        \"hostname\": \"$hostname\",
        \"timestamp\": $timestamp,
        \"cpu\": {
            \"last1min\": $cpu_last1min,
            \"last5min\": $cpu_last5min,
            \"last15min\": $cpu_last15min
        },
        \"ram\": {
            \"total\": $ram_total,
            \"used\": $ram_used,
            \"free\": $ram_free,
            \"available\": $ram_available
        },
        \"network\": {
            \"received\": $pkt_received,
            \"sent\": $pkt_sent
        },
        \"io\": {
            \"read\": $io_read,
            \"write\": $io_write
        }
    }" http://$COLLECTOR_HOST/collect
    sleep 5
done