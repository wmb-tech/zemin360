FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/ai/package.json packages/ai/
COPY packages/evidence/package.json packages/evidence/
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 3100
CMD ["sh", "-c", "bun run --cwd packages/db migrate && bun run --cwd apps/api start"]
