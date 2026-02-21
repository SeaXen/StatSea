import logging

from cachetools import TTLCache
from ipwhois import IPWhois

# Cache results for 24 hours (max 1000 items)
cache = TTLCache(maxsize=1000, ttl=86400)

logger = logging.getLogger("statsea.ip_intel")


import ipaddress

def get_ip_info(ip_address: str):
    """
    Retrieves WHOIS and location information for an IP address.
    Returns cached result if available.
    """
    # Skip private IPs using robust check
    try:
        ip_obj = ipaddress.ip_address(ip_address)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
            return {
                "ip": ip_address,
                "private": True,
                "org": "Local Network",
                "country": "LAN",
                "asn": "N/A",
            }
    except ValueError:
        return {"ip": ip_address, "error": "Invalid IP", "org": "Unknown", "country": "Unknown"}

    if ip_address in cache:
        return cache[ip_address]

    try:
        obj = IPWhois(ip_address)
        # timeout=2 to prevent hanging
        results = obj.lookup_rdap(depth=1, retry_count=1)

        info = {
            "ip": ip_address,
            "private": False,
            "org": results.get(
                "asn_description", results.get("network", {}).get("name", "Unknown")
            ),
            "asn": results.get("asn", "N/A"),
            "country": results.get("asn_country_code", "Unknown"),
            "abuse_contact": results.get("objects", {})
            .get(results.get("handle", ""), {})
            .get("contact", {})
            .get("email", [{}])[0]
            .get("value", "N/A")
            if results.get("objects")
            else "N/A",
            "subnet": results.get("network", {}).get("cidr", "N/A"),
        }

        cache[ip_address] = info
        return info

    except Exception as e:
        logger.error(f"Failed to lookup IP {ip_address}: {e}")
        return {"ip": ip_address, "error": str(e), "org": "Lookup Failed", "country": "Unknown"}
