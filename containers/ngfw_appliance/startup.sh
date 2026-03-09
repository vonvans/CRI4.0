#Frontend environment variables
INPUT_PORT="502"
OUTPUT_ENDPOINT="10.0.1.1:502"

sed -i '/stream {/a \
    server {\
        listen '"${INPUT_PORT}"';\
        proxy_pass '"${OUTPUT_ENDPOINT}"';\
    }' /etc/nginx/nginx.conf
sudo nginx -t
service nginx stop && service nginx start

