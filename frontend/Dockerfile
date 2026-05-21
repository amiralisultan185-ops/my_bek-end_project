FROM nginx:1.27-alpine

ENV API_PROXY_PASS=http://app:3001/
ENV API_PROXY_HOST=app
ENV API_BASE_URL=

COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY frontend/index.html /usr/share/nginx/html/index.html
COPY frontend/styles.css /usr/share/nginx/html/styles.css
COPY frontend/app.js /usr/share/nginx/html/app.js
COPY frontend/config.template.js /usr/share/nginx/html/config.template.js

EXPOSE 80

CMD ["sh", "-c", "envsubst '$API_BASE_URL' < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js && envsubst '$API_PROXY_PASS $API_PROXY_HOST' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
