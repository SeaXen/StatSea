from scapy.all import sniff, TCP, Raw
from scapy.layers.tls.all import TLS, TLS_Ext_ServerName
import sys

def parse(pkt):
    if pkt.haslayer(TCP) and pkt.haslayer(Raw):
        payload = bytes(pkt[Raw].load)
        if len(payload) > 5 and payload[0] == 0x16 and payload[5] == 0x01:
            try:
                tls = TLS(payload)
                if tls.haslayer(TLS_Ext_ServerName):
                    for server in tls[TLS_Ext_ServerName].servernames:
                        print("Found SNI:", server.servername.decode('utf-8'))
                        sys.exit(0)
            except Exception as e:
                pass

print("Sniffing 10 packets on port 443...")
sniff(filter="tcp dst port 443", prn=parse, count=50, timeout=10)
print("Done")
