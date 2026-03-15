apt update
apt install -y nginx-full
sed -i '\|/etc/nginx/sites-enabled|d' /etc/nginx/nginx.conf
tee -a /etc/nginx/nginx.conf > /dev/null << __EOF__ 
stream {
}
__EOF__