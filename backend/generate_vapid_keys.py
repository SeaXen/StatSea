from pywebpush import vapid_codes
import json

def generate_keys():
    """Generate VAPID keys for push notifications."""
    print("Generating VAPID keys...")
    vapid_key = vapid_codes.generate_vapid_codes()
    
    print("\n--- NEW VAPID KEYS ---")
    print(f"VAPID_PUBLIC_KEY={vapid_key['public_key']}")
    print(f"VAPID_PRIVATE_KEY={vapid_key['private_key']}")
    print("VAPID_ADMIN_EMAIL=admin@statsea.dev")
    print("----------------------\n")
    print("Add the above keys to your backend/.env file and restart the server.")

if __name__ == "__main__":
    generate_keys()
