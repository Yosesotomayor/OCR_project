FROM node:20-slim AS build
WORKDIR /app

# El contexto de build es la raíz del proyecto
COPY frontend/package*.json ./

# Usamos npm ci para builds determinísticos si existe el lockfile
# Si falla (por versiones desincronizadas), cae a npm install
RUN npm ci || npm install

COPY frontend/ .
RUN npm run build

FROM nginx:stable-alpine
# Copiamos el build de Vite al directorio de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Configuración de Nginx para soportar el enrutamiento de React (SPA)
# Esto redirige todas las rutas al index.html para que React Router las maneje
RUN sed -i 's/index  index.html index.htm;/index  index.html index.htm; try_files $uri $uri\/ \/index.html;/g' /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
