FROM nginx:alpine

COPY index.html app.js styles.css /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 80
