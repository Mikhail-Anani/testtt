#!/bin/bash
set -e

echo "🚀 Starting GameVault application..."

# Navigate to backend directory
cd backend

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Verify build
if [ ! -f "dist/server.js" ]; then
  echo "❌ Error: Build failed - dist/server.js not found"
  exit 1
fi

# Start the server
echo "✅ Starting server..."
npm start

