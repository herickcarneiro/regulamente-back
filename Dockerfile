# syntax=docker/dockerfile:1

FROM oven/bun:1.3.5 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS migrate
COPY package.json bun.lock tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src

FROM deps AS build
COPY . .
ENV DATABASE_URL=
RUN bun test
RUN bun run typecheck

FROM oven/bun:1.3.5 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/bun.lock /app/tsconfig.json /app/drizzle.config.ts ./
COPY --from=build /app/src ./src
COPY --from=build /app/drizzle ./drizzle
USER bun
EXPOSE 3000
CMD ["bun", "run", "src/main/server.ts"]
