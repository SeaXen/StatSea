# Backend Dockerfile
FROM python:3.11-slim

# Install system dependencies for Scapy and PCAP
RUN apt-get update && apt-get install -y \
    libpcap-dev \
    gcc \
    curl \
    libcap2-bin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Allow python to use raw sockets for scapy without being root
RUN setcap cap_net_raw,cap_net_admin=eip /usr/local/bin/python

# Copy application code
COPY . .

# Ensure data directory exists for SQLite
RUN mkdir -p /app/data

# Create non-root user and set ownership
RUN useradd -m -r statsea && \
    chown -R statsea:statsea /app

USER statsea

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:21081/health || exit 1

# Expose port (Internal FastAPI port)
EXPOSE 21081

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "21081", "--workers", "2"]
