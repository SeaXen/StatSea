
import socket
import struct

def send_magic_packet(mac_address: str, ip_address: str = '255.255.255.255', port: int = 9):
    """
    Sends a Wake-on-LAN magic packet to the specified MAC address.
    """
    # Remove separators from MAC address
    mac_clean = mac_address.replace(':', '').replace('-', '')
    
    if len(mac_clean) != 12:
        raise ValueError(f"Invalid MAC address: {mac_address}")
    
    # Create magic packet
    # 6 bytes of 0xFF followed by 16 repetitions of the MAC address
    data = b'\xff' * 6 + (bytes.fromhex(mac_clean) * 16)
    
    # Send packet via UDP
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.sendto(data, (ip_address, port))
        
def wake_device(mac: str):
    """
    High-level function to wake a device.
    TODO: In the future, we could lookup the device's last known IP to send unicast if broadcast fails,
    but broadcast is standard for WoL.
    """
    try:
        send_magic_packet(mac)
        return True
    except Exception as e:
        print(f"Failed to send WoL packet to {mac}: {e}")
        return False
