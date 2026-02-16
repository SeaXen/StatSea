import time
import random
import json

# Mock Data Generator for Development
# Simulates traffic when Npcap/Root privileges are not available

DEVICES = [
    {"mac": "AA:BB:CC:DD:EE:01", "ip": "192.168.1.10", "vendor": "Apple"},
    {"mac": "AA:BB:CC:DD:EE:02", "ip": "192.168.1.11", "vendor": "Samsung"},
    {"mac": "AA:BB:CC:DD:EE:03", "ip": "192.168.1.12", "vendor": "Google"},
    {"mac": "AA:BB:CC:DD:EE:04", "ip": "192.168.1.20", "vendor": "Intel"},
]

def generate_packet():
    src = random.choice(DEVICES)
    dst_ip = f"142.250.{random.randint(0,255)}.{random.randint(0,255)}" # Google-ish IP
    size = random.randint(64, 1500)
    return {
        "src_mac": src["mac"],
        "src_ip": src["ip"],
        "dst_ip": dst_ip,
        "size": size,
        "timestamp": time.time()
    }

print("[*] Starting MOCK Packet Capture (Dev Mode)...")

try:
    while True:
        # Simulate traffic burst
        packets = [generate_packet() for _ in range(random.randint(10, 100))]
        
        total_bytes = sum(p["size"] for p in packets)
        pps = len(packets)
        mbps = (total_bytes * 8) / 1_000_000
        
        print(f"[+] Captured {len(packets)} packets | Speed: {mbps:.2f} Mbps | Active Devices: {len(set(p['src_mac'] for p in packets))}")
        
        # In real app, this would push to DB or Aggregator
        
        time.sleep(1) # Report every second

except KeyboardInterrupt:
    print("\n[*] Stopping Mock Capture")
