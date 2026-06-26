# Changelog

All notable changes to this project will be documented in this file.

## [1.5.15] - 2026-06-26

### Fixed
- **Double Modifier Announcement Fix**: Fixed an annoying bug in Chaos Mode where the active event modifier was incorrectly announcing itself twice (once at the start of the Spymaster's turn, and again after they submitted a clue). Modifiers will now correctly announce only once when they are initially rolled.

## [1.5.14] - 2026-06-26

### Fixed
- **Optimistic UI Updates for Team Joins**: Eradicated the annoying ~5-second network delay when clicking "Join Team" while connected remotely through Ngrok! The UI now optimistically moves you to your selected team instantly, masking latency and making the lobby feel incredibly snappy even on weak connections.

## [1.5.13] - 2026-06-26

### Added
- **Core Engine Upgrades**: Introduced a robust, native auto-updating architecture for Core Engine updates! The game now gracefully distinguishes between lightning-fast Hot-Swap UI updates and full Core Engine reinstalls. If a Core Engine update is available, you will be prompted right in the app to download it seamlessly with a live progress bar, without ever needing to visit the GitHub Releases page again!

## [1.5.12] - 2026-06-26

### Added
- **Deep Linking**: Clicking an invite link will now attempt to automatically open the Codenames desktop app if it is installed on the user's computer. If the app is not installed, it falls back to the browser experience seamlessly.
- **Linux Build**: Added Linux compilation target to the GitHub Actions release workflow.

### Fixed
- Fixed an issue where guest users were not prompted to set up their nickname and profile avatar when joining via a shared link. They are now redirected to the Home page to complete their profile before entering the room.
- Fixed a major layout bug where avatars would appear stretched, sliced, or completely invisible on certain browser window sizes due to CSS grid height collapsing.
- Fully resolved the issue preventing the special Gav and Yoss avatars from rendering correctly for web browser guests by returning to embedded Base64 strings.
- Fixed frontend static file path resolution issues when running the packaged Electron app.

