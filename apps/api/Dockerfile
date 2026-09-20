# Tek imaj: API + web statik dosyaları (API /'den servis eder). Mobil imaja girmez.
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/ai/package.json packages/ai/
COPY packages/evidence/package.json packages/evidence/
# Mobil bağımlılıkları (expo, react-native) sunucuda gereksiz; kilit dosyası korunur.
RUN bun install --frozen-lockfile --filter '!@evidex/mobile'
COPY . .
RUN bun run --filter '@evidex/web' build
EXPOSE 3100
CMD ["sh", "-c", "bun run --cwd packages/db migrate && bun run --cwd apps/api start"]
