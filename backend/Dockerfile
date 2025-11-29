FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript and verify
RUN npm run build && \
    test -f dist/server.js || (echo "ERROR: dist/server.js not found after build" && echo "Contents of /app:" && ls -la && echo "Contents of dist (if exists):" && ls -la dist/ 2>/dev/null || echo "dist directory does not exist" && exit 1)

# Remove dev dependencies but keep dist and node_modules
RUN npm prune --production

# Verify dist still exists after prune
RUN test -f dist/server.js || (echo "ERROR: dist/server.js removed by npm prune" && exit 1)

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/server.js"]

