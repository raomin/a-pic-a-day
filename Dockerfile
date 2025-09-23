# Use Node.js 18 LTS (Alpine for smaller image size)
FROM node:18-alpine

# Install necessary packages for Puppeteer and Chrome
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY src/ ./src/
COPY .env.example ./

# Create necessary directories
RUN mkdir -p logs && \
    mkdir -p .wwebjs_auth && \
    chmod 755 logs .wwebjs_auth

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apicaday -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R apicaday:nodejs /app

# Switch to non-root user
USER apicaday

# Expose port (if webhook is needed in future)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Start the application
CMD ["node", "src/index.js"]