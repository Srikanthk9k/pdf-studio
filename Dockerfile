FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libreoffice \
    ghostscript \
    poppler-utils \
    libvips-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files for dependency installation
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install all dependencies
RUN npm install --workspaces --include-workspace-root

# Copy all source files
COPY . .

# Build client and server
RUN npm run build

# Expose port
EXPOSE 10000

# Start the server (which also serves the static client build)
CMD ["npm", "start"]
