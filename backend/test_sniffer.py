
from scapy.all import conf, get_if_list, get_working_if, sniff

print(f"Scapy version: {conf.version}")
print(f"PCAP provider available: {conf.use_pcap}")
print(f"Default interface: {get_working_if()}")

def packet_callback(packet):
    print(f"Packet: {packet.summary()}")

print("\nAttempting to sniff 5 packets on default interface...")
try:
    sniff(count=5, prn=packet_callback, timeout=10)
    print("Sniffing successful!")
except Exception as e:
    print(f"Sniffing failed: {e}")

print("\nInterface List:")
for iface in get_if_list():
    print(f" - {iface}")
