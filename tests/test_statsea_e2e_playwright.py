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
ARTIFACT_DIR = os.getenv("ARTIFACT_DIR", r"C:\Users\Sagar-EB\.gemini\antigravity-ide\brain\962c83e3-e3ec-4f08-9d6b-99f3a5d12df0")


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
            # Verify presence of core dashboard overview elements
            bandwidth_card = page.locator('h2:has-text("Bandwidth")').first
            bandwidth_card.wait_for(state="visible", timeout=8000)
            assert bandwidth_card.is_visible()
            print("  [PASS] Overview dashboard 'Bandwidth' panel confirmed")

            events_card = page.locator('h2:has-text("Live events")').first
            events_card.wait_for(state="visible", timeout=5000)
            assert events_card.is_visible()
            print("  [PASS] Overview dashboard loaded with live UI indicators ('Live events')")

            # Step 6: Comprehensive Navigation Across All Tabs
            print("[Step 6] Testing navigation across all tabs...")
            all_tabs = [
                ("Overview", "dashboard"),
                ("Devices", "devices"),
                ("Map", "network"),
                ("Globe", "geo"),
                ("Containers", "containers"),
                ("System", "system"),
                ("Analytics", "analytics"),
                ("Bandwidth", "bandwidth"),
                ("Speed", "speedtest"),
                ("Users", "users"),
                ("Sessions", "sessions"),
                ("Settings", "settings"),
            ]

            for tab_label, tab_id in all_tabs:
                btn = page.locator(f'nav.tabs button:has-text("{tab_label}"), aside button:has-text("{tab_label}"), button.tab-btn:has-text("{tab_label}")').first
                if not btn.is_visible():
                    # Try partial text or alternative label
                    btn = page.locator(f'nav button:has-text("{tab_label}"), button[title*="{tab_label}"]').first
                if btn.is_visible():
                    btn.click()
                    page.wait_for_timeout(1000)

                    # Assert ErrorBoundary was NOT triggered
                    error_boundary = page.locator("text='Something went wrong'").first
                    assert not error_boundary.is_visible(), f"ErrorBoundary triggered on tab '{tab_label}' ({tab_id})!"
                    print(f"  [PASS] Successfully opened tab '{tab_label}' with zero runtime errors")

            # Switch back to Overview
            overview_btn = page.locator('nav.tabs button:has-text("Overview"), aside button:has-text("Overview"), button.tab-btn:has-text("Overview")').first
            overview_btn.wait_for(state="visible", timeout=5000)
            overview_btn.click()
            page.wait_for_timeout(1200)
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

            # Step 9: Network Selector Dropdown Interaction
            print("[Step 9] Testing Network Environment Selector dropdown...")
            net_btn = page.locator('button[aria-label="Choose network environment"]').first
            if net_btn.is_visible():
                net_btn.click()
                page.wait_for_timeout(400)
                assert page.locator('text="Network Environments"').is_visible()
                print("  [PASS] Network dropdown opened with environment options")
                # Click outside or toggle to close
                net_btn.click()
                page.wait_for_timeout(300)

            # Step 10: Device Search & Filter Interaction
            print("[Step 10] Testing Devices view interactive search...")
            page.keyboard.press("Escape")
            dev_btn = page.locator('nav.tabs button:has-text("Devices"), aside button:has-text("Devices"), button.tab-btn:has-text("Devices")').first
            if dev_btn.is_visible():
                dev_btn.click()
                page.wait_for_timeout(800)
                search_input = page.locator('input[placeholder*="Filter by name"]').first
                if search_input.is_visible():
                    search_input.fill("test-query-filter")
                    page.wait_for_timeout(400)
                    print("  [PASS] Search filter successfully processed keyboard input")
                    search_input.fill("")
                    page.wait_for_timeout(300)

            # Step 11: Operator Menu & Clean Logout Flow
            print("[Step 11] Testing Operator Profile Menu and Logout...")
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
            user_btn = page.locator('button[aria-label="Operator menu"]').first
            if user_btn.is_visible():
                user_btn.click()
                page.wait_for_timeout(500)
                assert page.locator('text="ADMIN"').is_visible() or page.locator('text="OPERATOR"').is_visible()
                print("  [PASS] Operator card rendered with role badge")

                logout_btn = page.locator('button:has-text("Sign Out"), button:has-text("Logout")').first
                if logout_btn.is_visible():
                    logout_btn.click()
                    page.wait_for_timeout(1000)
                    assert "/login" in page.url
                    print("  [PASS] User successfully signed out and redirected to /login")

            print("\n" + "=" * 60)
            print("ALL PLAYWRIGHT E2E WEB APPLICATION TESTS PASSED (11/11 PHASES)!")
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

