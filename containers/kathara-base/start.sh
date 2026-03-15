# add to known host
ADDRESSES=$(ansible-inventory -i hosts --list \
| jq -r '..|.ansible_host?|select(.)' | sort -u)

for addr in $ADDRESSES; do
    ssh-keyscan -H $addr >> ~/.ssh/known_hosts
done

service ssh start

tail -f /dev/null
