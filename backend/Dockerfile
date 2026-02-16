# Backend Dockerfile
FROM python:3.11-slim

# Install system dependencies for Scapy and PCAP
RUN apt-get update && apt-get install -y \
    libpcap-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Ensure data directory exists for SQLite
RUN mkdir -p /app/data

# Expose port (Internal FastAPI port)
EXPOSE 21081

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "21081"]
