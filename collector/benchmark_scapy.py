import time
import psutil
from scapy.all import sniff, conf

# Configuration
CAPTURE_DURATION = 10  # seconds
INTERFACE = conf.iface # Default interface

print(f"[*] Starting Packet Capture Benchmarking on {INTERFACE}...")
print(f"[*] Capture duration: {CAPTURE_DURATION} seconds")

# Metrics
packet_count = 0
total_bytes = 0
start_time = 0

def packet_callback(packet):
    global packet_count, total_bytes
    packet_count += 1
    total_bytes += len(packet)

try:
    start_time = time.time()
    # store=0 avoids keeping packets in memory (critical for performance)
    # prn=packet_callback calculates stats on the fly
    sniff(iface=INTERFACE, prn=packet_callback, store=0, timeout=CAPTURE_DURATION)
    end_time = time.time()

    duration = end_time - start_time
    pps = packet_count / duration
    bps = (total_bytes * 8) / duration / 1000000  # Mbps

    print("\n" + "="*40)
    print(f"BENCHMARK RESULTS ({duration:.2f}s)")
    print(f"Total Packets: {packet_count}")
    print(f"Total Bytes:   {total_bytes}")
    print(f"Speed:         {pps:.2f} packets/sec")
    print(f"Bandwidth:     {bps:.2f} Mbps")
    print("="*40)

except Exception as e:
    print(f"\n[!] Error during capture: {e}")
    print("[!] Ensure you are running as Administrator/Root")
