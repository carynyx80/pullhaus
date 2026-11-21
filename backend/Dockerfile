FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared packages/shared
COPY backend backend
RUN pnpm install --frozen-lockfile --filter @pullhaus/backend...
RUN pnpm --filter @pullhaus/shared build
RUN DATABASE_URL="postgresql://pullhaus:pullhaus@127.0.0.1:5432/pullhaus" pnpm --filter @pullhaus/backend exec prisma generate
RUN pnpm --filter @pullhaus/backend build
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
