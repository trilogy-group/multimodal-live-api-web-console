#!/bin/bash

# Ensure we start fresh
docker compose down -v

# Build and run the container
docker compose up --build

# Copy the dist folder to the host
mkdir -p dist
docker cp $(docker compose ps -q electron-builder):/app/dist ./

echo "Build complete! Check the ./dist directory for your Windows packages." 