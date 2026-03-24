# Stage 1: Build the frontend, and install server dependencies
FROM node:22-slim AS builder

WORKDIR /app

# Copy all files
COPY . ./

# Install server dependencies
WORKDIR /app/server
RUN npm install --omit=dev

# Install frontend dependencies and build
WORKDIR /app
RUN if [ -f package.json ]; then npm install && npm run build; fi


# Stage 2: Final production image
FROM node:22-slim

# Set environment
ENV NODE_ENV=production

WORKDIR /app

# Copy built server and frontend files from builder
COPY --from=builder /app/server .
COPY --from=builder /app/dist ./dist

# Use the built-in 'node' user for better security
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Healthcheck to ensure container is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (res) => res.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "server.js"]
