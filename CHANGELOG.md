# Changelog

All notable changes to the YT-DLP Web Interface.

## [Unreleased] — 2026-11-20

### Added
- Accessible tooltips on the download composer's output settings.
- An in-app "What's new" dialog, opened from the sidebar.
- Loading skeleton, empty state and error state for the format picker.
- Per-column filters and sortable columns in the format picker.
- Explicit "Use" and "+ Audio" actions on each format row.
- A persistent selected-format notice showing the chosen format's container, resolution, codec and stream type, with Change/Clear actions.

### Changed
- Redesigned the download composer around peer-level **Video** and **Audio** modes instead of one mixed quality dropdown.
  - Video exposes Resolution and Container.
  - Audio exposes Quality and Audio format.
  - Presets remain the primary path; advanced options are progressively disclosed.
- Removed the redundant `custom` quality entry. `List Formats` is now the explicit advanced format override.
- Switching modes keeps each mode's settings but clears an incompatible format override.
- Audio-only downloads can pass an audio quality (`--audio-quality`) to yt-dlp.

## [1.0.0]

### Added
- Node.js + Express backend and Vue 3 + Vite frontend.
- Metadata lookup, playlist/channel scraping and batch queueing.
- Persistent parallel download queue with live SSE progress, pause/resume/cancel.
- Library with search, file actions and download history.
- Subscriptions manager for channels.
- yt-dlp flags/options editor and managed yt-dlp/ffmpeg binaries.
- Optional local hostname alias and local HTTPS.
