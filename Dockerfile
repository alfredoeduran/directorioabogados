# ---------- BUILD ----------
FROM node:18-alpine AS builder
WORKDIR /src
# Copiar todo para que npm ci funcione
COPY package*.json ./
RUN npm ci --production --ignore-scripts

# ---------- RUNTIME ----------
FROM node:18-alpine
WORKDIR /app

# Usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Copiar dependencias y código
COPY --from=builder /src/node_modules ./node_modules
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY services ./services
COPY config ./config
COPY dist ./dist

# Base de datos vacía (opcional, se crea al arrancar)
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["node","server.js"]