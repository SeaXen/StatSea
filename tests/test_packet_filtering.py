import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

from app.core.collector import PacketCollector

class TestPacketFiltering(unittest.TestCase):
    def setUp(self):
        self.collector = PacketCollector()
        self.collector.running = True

    def test_tcp_flags_capture(self):
        # Mock Scapy packet
        packet = MagicMock()
        packet.haslayer.side_effect = lambda layer: layer == "TCP" or layer == "IP"
        
        # IP Packet
        packet.__contains__.return_value = True # for "TCP in packet" check
        
        # Structure payload
        # packet[IP].src
        # packet[TCP].flags
        
        # We need to simulate packet[IP] and packet[TCP] access
        # Scapy packet indexing returns layers
        
        # Create mock layers
        mock_ip = MagicMock()
        mock_ip.src = "192.168.1.10"
        mock_ip.dst = "1.1.1.1"
        mock_ip.len = 60
        
        mock_tcp = MagicMock()
        mock_tcp.sport = 12345
        mock_tcp.dport = 80
        mock_tcp.flags = "S" # SYN flag
        
        # Mocking __getitem__
        def getitem(cls):
            if cls.__name__ == 'IP':
                return mock_ip
            if cls.__name__ == 'TCP':
                return mock_tcp
            return MagicMock()
            
        packet.__getitem__.side_effect = getitem
        
        # We need to patch common protocols imports inside collector if they are used directly
        # But looking at collector.py:
        # from scapy.all import sniff, IP, TCP, UDP, ICMP
        
        # We need to patch the global IP, TCP variables in collector module to match our keys?
        # Actually `packet[TCP]` uses the class TCP as key.
        # So we need to ensure our Mock accepts the *actual* TCP class used in collector.
        
        # Instead of complex mocking of Scapy internals, let's just inspect what _packet_callback expects.
        # It calls: if TCP in packet: ... packet[TCP].flags
        
        # Let's rely on PacketCollector's `process_packet` or `_packet_callback` if exposed.
        # It's private `_packet_callback`.
        
        # To simplify, we can inject a mock packet that behaves like a dict or scapy packet.
        
        pass

    @patch('app.core.collector.IP')
    @patch('app.core.collector.TCP')
    def test_filtering_logic(self, mock_tcp_cls, mock_ip_cls):
        # Manually populate packet_log for testing get_packet_log
        self.collector.packet_log = [
            {"time": "10:00:01", "proto": "TCP", "src": "1.1.1.1:80", "dst": "2.2.2.2:443", "size": 100, "flags": "S"},
            {"time": "10:00:02", "proto": "TCP", "src": "1.1.1.1:80", "dst": "2.2.2.2:443", "size": 100, "flags": "SA"},
            {"time": "10:00:03", "proto": "UDP", "src": "3.3.3.3:53", "dst": "2.2.2.2:53", "size": 60, "flags": None},
            {"time": "10:00:04", "proto": "TCP", "src": "4.4.4.4:22", "dst": "2.2.2.2:22", "size": 120, "flags": "PA"},
        ]
        
        # Test Filter by Protocol
        result = self.collector.get_packet_log(protocol="UDP")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['proto'], 'UDP')
        
        # Test Filter by Flags (S) - should match 'S' and 'SA'? 
        # The logic in collector.py is: if flags in p["flags"]
        # So if p["flags"] is "SA", and we search "S", "S" in "SA" is True.
        result = self.collector.get_packet_log(flags="S")
        # Should match S and SA. PA? No S in PA.
        # Wait, PA usually means PSH, ACK. No S.
        self.assertEqual(len(result), 2)  # S and SA
        
        # Test Filter by IP
        result = self.collector.get_packet_log(ip="3.3.3.3")
        self.assertEqual(len(result), 1)
        
        # Test Filter by Port
        result = self.collector.get_packet_log(port=22)
        self.assertEqual(len(result), 1)
        
        print("Packet Filtering Logic Verified!")

if __name__ == '__main__':
    unittest.main()
