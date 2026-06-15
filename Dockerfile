FROM node:22-bookworm-slim AS deps

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_BACKEND_API_BASE_URL
ARG NEXT_PUBLIC_UPSTREAM_API_BASE_URL=https://cha.nerver.cc
ENV NEXT_PUBLIC_BACKEND_API_BASE_URL=${NEXT_PUBLIC_BACKEND_API_BASE_URL}
ENV NEXT_PUBLIC_UPSTREAM_API_BASE_URL=${NEXT_PUBLIC_UPSTREAM_API_BASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3001

CMD ["node", "server.js"]
