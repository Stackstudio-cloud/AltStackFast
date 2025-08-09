# Use Node.js with system dependencies for Playwright
FROM node:20-slim

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libatspi2.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files for workspace setup
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig*.json ./

# Copy the entire packages directory first
COPY packages/ ./packages/

# Install all dependencies (this will install workspace dependencies)
RUN npm install

# Build all packages using turbo
RUN npx turbo run build

# Install Playwright browsers
RUN npx playwright install --with-deps chromium

# Set the final command to run the compiled worker
CMD ["node", "packages/worker/dist/worker.js"] 