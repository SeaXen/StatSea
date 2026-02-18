# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2024-05-24

### Added
- **UI/UX**: Implemented `EmptyState` component for better user feedback on empty pages.
- **UI/UX**: Added `OnboardingTour` for first-time users.
- **Accessibility**: Added ARIA labels to TopNav and BottomNav buttons.
- **Security**: Added Swagger documentation to all API endpoints.
- **Dev**: Added `CONTRIBUTING.md` and architecture diagram to `README.md`.

### Changed
- **Styling**: Migrated to HSL-based CSS variables for better theme switching and opacity support.
- **Performance**: Implemented WebSocket throttling to limit updates to 2/sec.
- **Backend**: Refactored API endpoints to include detailed summary and descriptions.

### Fixed
- **Testing**: Fixed `test_auth.py` to use correct password hashing method.
- **Testing**: Updated `conftest.py` to use correct async client base URL.

## [0.9.0] - 2024-05-20

### Added
- Initial release of Phase 9 features.
- Basic dashboard structure.
- Network device scanning with Scapy.
