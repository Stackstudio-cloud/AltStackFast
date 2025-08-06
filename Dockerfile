# Use a slim, modern version of Node.js
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files for workspace setup
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig*.json ./

# Install dependencies (this will install all workspace dependencies)
RUN npm install

# Copy the entire packages directory
COPY packages/ ./packages/

# Build the worker package and its dependencies using turbo
RUN npx turbo run build --filter=@altstackfast/worker

# Set the final command to run the compiled worker
CMD ["node", "packages/worker/dist/worker.js"] 