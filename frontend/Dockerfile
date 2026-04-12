# Сборка SPA + nginx как reverse proxy к backend (docker-compose)
FROM node:22-alpine AS build
WORKDIR /app
ARG BUILD_MODE=production
ARG VITE_STAGING_ACCESS_TOKEN=
ENV VITE_STAGING_ACCESS_TOKEN=$VITE_STAGING_ACCESS_TOKEN
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build -- --mode ${BUILD_MODE}

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-docker.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
