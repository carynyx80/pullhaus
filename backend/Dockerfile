FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared packages/shared
COPY backend backend
RUN pnpm install --frozen-lockfile --filter @pullhaus/backend...
RUN pnpm --filter @pullhaus/shared build
RUN pnpm --filter @pullhaus/backend exec prisma generate
RUN pnpm --filter @pullhaus/backend build
WORKDIR /app/backend
ENV PORT=4181
EXPOSE 4181
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
