#!/bin/bash

# StatSea Deployment Script
echo "StatSea: Starting deployment for Linux Mint / CasaOS..."

# Ensure we are in the project root
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: docker-compose.yml not found. Please run this from the project root."
    exit 1
fi

# Production requires strong secrets; generate them on first deploy.
if ! grep -q '^JWT_SECRET_KEY=' .env 2>/dev/null; then
    echo "Generating a random JWT_SECRET_KEY in .env..."
    echo "JWT_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')" >> .env
fi
if ! grep -q '^ADMIN_PASSWORD=' .env 2>/dev/null; then
    echo "Generating a random ADMIN_PASSWORD in .env (store it somewhere safe)..."
    echo "ADMIN_PASSWORD=$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')" >> .env
fi

# Build and Start
echo "Building and starting containers in host network mode..."
docker compose up -d --build

echo "-------------------------------------------------------"
echo "StatSea is now deploying!"
echo "Frontend: http://localhost:21080"
echo "Backend/API: http://localhost:21081"
echo "-------------------------------------------------------"
echo "Note: If you are using CasaOS, use Port 21080 for the WebUI."
