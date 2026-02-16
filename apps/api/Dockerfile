FROM node:22-alpine

WORKDIR /app

# Copy root package files for workspace install
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all dependencies
RUN npm ci --workspace=packages/shared --workspace=apps/api --include-workspace-root

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY tsconfig.base.json ./

# Build shared package
RUN npm run build -w packages/shared

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build API
RUN npm run build -w apps/api

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
