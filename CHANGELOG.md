# Changelog

All notable changes to this project will be documented in this file.

## [1.5.12] - 2026-06-26

### Added
- **Deep Linking**: Clicking an invite link will now attempt to automatically open the Codenames desktop app if it is installed on the user's computer. If the app is not installed, it falls back to the browser experience seamlessly.
- **Linux Build**: Added Linux compilation target to the GitHub Actions release workflow.

### Fixed
- Fixed an issue where guest users were not prompted to set up their nickname and profile avatar when joining via a shared link. They are now redirected to the Home page to complete their profile before entering the room.
- Fixed a major layout bug where avatars would appear stretched, sliced, or completely invisible on certain browser window sizes due to CSS grid height collapsing.
- Fully resolved the issue preventing the special Gav and Yoss avatars from rendering correctly for web browser guests by returning to embedded Base64 strings.
- Fixed frontend static file path resolution issues when running the packaged Electron app.

