# ------------------------------
# 1. Base builder image
# ------------------------------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy all project files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build project (Vite + React Router + SSR)
RUN npm run build


# ------------------------------
# 2. Production runner image
# ------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/prisma ./prisma

# Ensure Prisma client exists in production
RUN npx prisma generate

# Expose port (React Router server runs on 3000 by default)
EXPOSE 3000

# Start the server
CMD ["npm", "run", "start"]

