#! /bin/bash

#protect service with https using caddy
sudo apt install -y caddy mkcert
echo "" > /etc/caddy/Caddyfile
mkcert -install
sudo mkdir -p /etc/caddy/certs
cd /etc/caddy/certs
mkcert -cert-file server.crt -key-file server.key "localhost" "127.0.0.1" $(hostname -I)
sudo chmod 777 /etc/caddy/certs/server.key

tee -a /etc/caddy/Caddyfile << __EOF__
:80 {
    tls /etc/caddy/certs/server.crt /etc/caddy/certs/server.key

    reverse_proxy 127.0.0.1:50000 {
        header_up Host {host}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto https
    }
}
__EOF__
sudo systemctl restart caddy


# Create login page with keycloak
sudo apt update
sudo apt install -y podman pwgen
sudo install -d -m 0750 /etc/keycloak
sudo tee /etc/keycloak/keycloak.env >/dev/null <<EOF
KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=cri40pwd
EOF
sudo chmod 0640 /etc/keycloak/keycloak.env
sudo chown root:root /etc/keycloak/keycloak.env
sudo install -d -m 0750 /var/lib/keycloak
sudo chown -R root:root /var/lib/keycloak
sudo install -d -m 0755 /etc/containers/systemd

sudo tee /etc/containers/systemd/keycloak.container >/dev/null <<__EOF__
[Unit]
Description=Keycloak (Podman Quadlet)
Wants=network-online.target
After=network-online.target

[Container]
Image=quay.io/keycloak/keycloak:latest
ContainerName=keycloak
AutoUpdate=registry
PublishPort=127.0.0.1:50000:8080
EnvironmentFile=/etc/keycloak/keycloak.env
Volume=/var/lib/keycloak:/opt/keycloak/data:Z
Exec=start-dev

[Service]
Restart=always
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
__EOF__
sudo systemctl daemon-reload
sudo systemctl start keycloak.service


