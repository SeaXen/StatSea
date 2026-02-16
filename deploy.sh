#!/bin/bash

# StatSea Deployment Script
echo "StatSea: Starting deployment for Linux Mint / CasaOS..."

# Ensure we are in the project root
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: docker-compose.yml not found. Please run this from the project root."
    exit 1
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
