# Multi-stage build for optimized Node.js SproutMC
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with production flag
RUN npm ci --only=production && npm cache clean --force

# Final stage
FROM node:18-alpine

WORKDIR /app

# Install Java 17 for Minecraft server
RUN apk add --no-cache openjdk17-jre-headless bash curl

# Copy built node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY . .

# Create required directories
RUN mkdir -p data logs backups instances public

# Non-root user for security
RUN addgroup -g 1000 nodeapp && adduser -D -u 1000 -G nodeapp nodeapp

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nodeapp

# Start application
CMD ["node", "src/server.js"]
