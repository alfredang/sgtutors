# SG Tutors — production image (client build + API served by one process)
FROM node:22-alpine

WORKDIR /app

# Install dependencies (workspace-aware)
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
# --include=dev: build tools (tsc, vite) and runtime runner (tsx, drizzle-kit) are
# devDeps, and Coolify injects NODE_ENV=production as a build arg which would skip them
RUN npm ci --include=dev

# Copy source and build the client bundle
COPY . .
ARG VITE_TURNSTILE_SITE_KEY=1x00000000000000000000BB
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN npm -w client run build

ENV NODE_ENV=production
EXPOSE 4000

# Apply schema + seed (idempotent), then start the API which also serves client/dist
CMD ["sh", "-c", "cd server && npx drizzle-kit push --force && npx tsx src/db/seed.ts && exec npx tsx src/index.ts"]
