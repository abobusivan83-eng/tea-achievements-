# Production API image (Чайные достижения)
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads/avatars uploads/banners uploads/misc
EXPOSE 4000
# Запись в volume uploads (часто root); при необходимости ужесточьте: chown + USER node
CMD ["node", "dist/src/server.js"]
