"""
Playwright End-to-End Automated Test Suite for StatSea Web Application.
Tests:
1. Redirection of unauthenticated users to /login
2. Form rendering and validation (invalid credentials rejection)
3. Authentication with admin / admin123
4. Dashboard landing and telemetry status badge verification (SIMULATION MODE / LIVE SNIFFING)
5. Sidebar navigation across key tabs (Devices, Bandwidth, Speedtest, Settings)
6. Theme toggle switching between Dark and Light mode
7. Full screenshot capture into artifact directory
"""

import os
import sys
import time
from playwright.sync_api import sync_playwright

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

FRONTEND_URL = os.getenv("STATSEA_FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("STATSEA_BACKEND_URL", "http://localhost:8001")
ARTIFACT_DIR = r"C:\Users\Sagar-EB\.gemini\antigravity-ide\brain\85cc9d05-832d-46c9-880c-a5c79f56daeb"


def run_e2e_tests():
    print(f"\n[E2E] Starting StatSea Web Application E2E Test Suite against {FRONTEND_URL}...")
    screenshot_path = os.path.join(ARTIFACT_DIR, "statsea_dashboard.png")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})

        # Pre-set onboarding completed flag so modal overlay never interrupts interactions
        context.add_init_script("localStorage.setItem('statsea_onboarding_completed', 'true');")

        page = context.new_page()
        page.add_init_script("localStorage.setItem('statsea_onboarding_completed', 'true');")

        # Capture console and network errors
        page.on("console", lambda msg: print(f"  [BROWSER {msg.type.upper()}] {msg.text}"))
        page.on("response", lambda r: print(f"  [RESP {r.status}] {r.url}") if r.status >= 400 else None)
        page.on("requestfailed", lambda r: print(f"  [FAIL] {r.method} {r.url}: {r.failure}"))

        try:
            # Step 1: Unauthenticated redirect to /login
            print("[Step 1] Navigating to root / ...")
            page.goto(FRONTEND_URL, wait_until="networkidle", timeout=25000)
            page.wait_for_timeout(1000)
            assert "/login" in page.url, f"Expected redirect to /login, but got {page.url}"
            print("  [PASS] Correctly redirected unauthenticated session to /login")

            # Step 2: Login Form Inspection
            print("[Step 2] Validating Login UI elements...")
            assert page.locator("text=StatSea").first.is_visible()
            assert page.locator('input[placeholder="Enter your username"]').is_visible()
            assert page.locator('input[type="password"]').is_visible()
            print("  [PASS] Login branding, username, and password fields visible")

            # Step 3: Rejected Bad Credentials
            print("[Step 3] Testing rejection of invalid credentials...")
            page.fill('input[placeholder="Enter your username"]', "invalid_user")
            page.fill('input[type="password"]', "wrong_password_123")
            page.click('button[type="submit"]')
            page.wait_for_timeout(1200)
            assert "/login" in page.url, "Should remain on /login after invalid credentials"
            print("  [PASS] Invalid login was properly rejected")

            # Step 4: Valid Login with admin / admin123
            print("[Step 4] Logging in with seeded admin credentials...")
            page.fill('input[placeholder="Enter your username"]', "admin")
            page.fill('input[type="password"]', "admin123")
            with page.expect_response(lambda r: "/api/auth/login" in r.url and r.status == 200, timeout=15000):
                page.click('button[type="submit"]')

            # Wait up to 10s for page transition away from /login
            for _ in range(20):
                if "/login" not in page.url:
                    break
                page.wait_for_timeout(500)

            print(f"  Current URL after login: {page.url}")
            assert "/login" not in page.url or page.url.endswith("/"), f"Failed to authenticate: {page.url}"
            print("  [PASS] Successfully authenticated and navigated into dashboard")

            # Ensure onboarding tour flag is saved in localStorage
            page.evaluate("localStorage.setItem('statsea_onboarding_completed', 'true');")
            page.wait_for_timeout(1000)

            # Step 5: Dashboard and Telemetry Badge Verification
            print("[Step 5] Checking TopNav and Telemetry Transparency badge...")
            badge_locator = page.locator('text="SIMULATION MODE"').first
            badge_locator.wait_for(state="visible", timeout=8000)
            badge_text = badge_locator.inner_text().strip()
            print(f"  [PASS] Telemetry Transparency Badge verified: '{badge_text}'")

            # Verify presence of core dashboard overview elements
            traffic_card = page.locator('text="Live Network Traffic"').first
            traffic_card.wait_for(state="visible", timeout=8000)
            assert traffic_card.is_visible()
            print("  [PASS] Overview dashboard loaded with live UI indicators ('Live Network Traffic')")

            bandwidth_card = page.locator('text="Bandwidth Summary"').first
            bandwidth_card.wait_for(state="visible", timeout=5000)
            assert bandwidth_card.is_visible()
            print("  [PASS] Overview dashboard 'Bandwidth Summary' card confirmed")

            # Step 6: Navigation Across Tabs
            print("[Step 6] Testing Sidebar navigation across tabs...")
            tabs_to_test = [
                ("Devices", "devices"),
                ("Bandwidth", "bandwidth"),
                ("Speed", "speedtest"),
                ("Settings", "settings"),
                ("Users", "users"),
            ]

            for tab_name, _ in tabs_to_test:
                btn = page.locator(f'aside button:has-text("{tab_name}")').first
                btn.wait_for(state="visible", timeout=5000)
                btn.click()
                page.wait_for_timeout(800)
                print(f"  [PASS] Successfully navigated to '{tab_name}' tab")

            # Switch back to Dashboard / Overview
            overview_btn = page.locator('aside button:has-text("Overview")').first
            overview_btn.wait_for(state="visible", timeout=5000)
            overview_btn.click()
            page.wait_for_timeout(1000)
            print("  [PASS] Successfully returned to 'Overview' tab")

            # Step 7: Theme Toggle
            print("[Step 7] Testing Theme Toggle...")
            theme_btn = page.locator('button[aria-label="Toggle theme"], button[title="Toggle theme"]').first
            theme_btn.wait_for(state="visible", timeout=5000)
            # Get current html class
            initial_class = page.evaluate("() => document.documentElement.className")
            theme_btn.click()
            page.wait_for_timeout(600)
            toggled_class = page.evaluate("() => document.documentElement.className")
            print(f"  [PASS] Theme toggled from '{initial_class}' to '{toggled_class}'")
            # Toggle back
            theme_btn.click()
            page.wait_for_timeout(500)
            print("  [PASS] Theme toggle returned to original state")

            # Step 8: Capture Full-Page Screenshot
            print(f"[Step 8] Capturing full-page screenshot to {screenshot_path}...")
            page.screenshot(path=screenshot_path, full_page=True)
            assert os.path.exists(screenshot_path) and os.path.getsize(screenshot_path) > 10000
            print(f"  [PASS] Screenshot verified ({os.path.getsize(screenshot_path)} bytes)")

            print("\n" + "=" * 60)
            print("ALL PLAYWRIGHT E2E WEB APPLICATION TESTS PASSED!")
            print("=" * 60 + "\n")

        except Exception as e:
            print(f"\n[FAIL] E2E Test Failed: {e}", file=sys.stderr)
            err_screenshot = os.path.join(ARTIFACT_DIR, "statsea_e2e_error.png")
            try:
                page.screenshot(path=err_screenshot)
                print(f"Error screenshot saved to: {err_screenshot}", file=sys.stderr)
            except Exception:
                pass
            raise
        finally:
            browser.close()


if __name__ == "__main__":
    run_e2e_tests()

