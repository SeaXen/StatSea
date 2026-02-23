#!/usr/bin/env python3
"""
StatSea Remote Agent
====================

A lightweight, zero-dependency (using only stdlib + psutil + requests)
script to collect system metrics and post them to a StatSea master node.

Prerequisites:
  pip install psutil requests

Usage:
  python statsea_agent.py --server http://192.168.1.100:8001 --id "YOUR_AGENT_ID" --key "YOUR_API_KEY"
"""

import time
import argparse
import socket
import logging
from datetime import datetime

try:
    import psutil
    import requests
except ImportError:
    print("Error: Missing required packages.")
    print("Please install them using: pip install psutil requests")
    exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("statsea-agent")

def collect_metrics():
    """Collect basic system metrics using psutil."""
    
    # CPU
    cpu_pct = psutil.cpu_percent(interval=1)
    
    # Memory
    mem = psutil.virtual_memory()
    mem_usage_mb = (mem.total - mem.available) / (1024 * 1024)
    
    # Disk (root partition)
    disk = psutil.disk_usage('/')
    disk_pct = disk.percent
    
    # Network (total over all interfaces since boot)
    net_io = psutil.net_io_counters()
    net_rx = net_io.bytes_recv
    net_tx = net_io.bytes_sent
    
    return {
        "cpu_pct": cpu_pct,
        "mem_usage": round(mem_usage_mb, 2),
        "disk_usage": disk_pct,
        "net_rx": net_rx,
        "net_tx": net_tx
    }

def main():
    parser = argparse.ArgumentParser(description="StatSea Remote Metric Agent")
    parser.add_argument("--server", required=True, help="StatSea master server URL (e.g., http://localhost:8001)")
    parser.add_argument("--id", required=True, help="Agent ID assigned by StatSea")
    parser.add_argument("--key", required=True, help="Agent API Key assigned by StatSea")
    parser.add_argument("--interval", type=int, default=60, help="Interval in seconds between metric submissions")
    
    args = parser.parse_args()
    
    server_url = args.server.rstrip('/')
    endpoint = f"{server_url}/api/agents/{args.id}/metrics"
    
    headers = {
        "X-Agent-Key": args.key,
        "Content-Type": "application/json"
    }
    
    logger.info(f"Starting StatSea Agent '{args.id}'")
    logger.info(f"Reporting to {server_url} every {args.interval}s")
    
    while True:
        try:
            metrics = collect_metrics()
            
            # Post metrics
            response = requests.post(endpoint, json=metrics, headers=headers, timeout=10)
            
            if response.status_code == 201:
                logger.debug(f"Successfully submitted metrics: {metrics}")
            else:
                logger.error(f"Failed to submit metrics. Status Code: {response.status_code}, Response: {response.text}")
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Connection error when communicating with server: {e}")
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            
        time.sleep(args.interval)

if __name__ == "__main__":
    main()
