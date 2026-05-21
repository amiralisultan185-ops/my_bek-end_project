FROM nginx:1.27-alpine

ENV API_PROXY_PASS=http://app:3001/
ENV API_PROXY_HOST=app

COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY frontend/index.html /usr/share/nginx/html/index.html
COPY frontend/styles.css /usr/share/nginx/html/styles.css
COPY frontend/app.js /usr/share/nginx/html/app.js

EXPOSE 80
