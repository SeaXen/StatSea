# Backend Dockerfile
FROM python:3.11-slim

# Install system dependencies for Scapy and PCAP
RUN apt-get update && apt-get install -y \
    libpcap-dev \
    gcc \
    curl \
    libcap2-bin \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Note: Raw socket permissions are granted via cap_add in docker-compose.yml
# No setcap needed when container has NET_RAW and NET_ADMIN capabilities

# Copy application code
COPY . .

# Ensure data directory exists for SQLite
RUN mkdir -p /app/data

# Create non-root user and set ownership
RUN useradd -m -r statsea && \
    chown -R statsea:statsea /app

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:21081/api/health || exit 1

# Expose port (Internal FastAPI port)
EXPOSE 21081

# Run the application (Single worker to prevent SQLite lock races)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "21081"]
