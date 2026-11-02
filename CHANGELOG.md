# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.0.0] - 2026-11-02

### Changed

- Renamed the app from **Hydrate Buddy** to **Pingo**, a general reminder buddy. Existing settings and
  custom characters are migrated automatically on first launch.
- Split the main process into focused modules under `src/` (scheduler, store,
  characters, windows, tray, IPC).
- Installers are now built for Windows, macOS and Linux.

### Security

- Renderer windows are sandboxed, and navigation and pop-ups are blocked.
- IPC handlers verify the sender and validate every argument.
- Tightened the Content-Security-Policy on every page.
- The pixel font is now bundled, so the app makes no network requests.

### Fixed

- Settings are written atomically, so they can no longer be corrupted by a crash
  mid-save.
- The tray tooltip and menu now refresh after pausing or unpausing.
- Character labels are rendered as text, never as HTML.

### Added

- Two new bundled characters, **ID badge** and **Sticker**, selectable from
  _Change character…_. The original is now labelled **Classic**.
- The pose-sheet slicer is driven by a per-character `layout.json`, supports flat
  backgrounds (flood fill) as well as AI matting, and can erase speech bubbles.
- Unit tests, ESLint, Prettier, EditorConfig and a cross-platform CI workflow.
- A static download website with deployment guides for Vercel, GitHub Pages,
  Hostinger and AWS.
- Contributor docs, a security policy, and issue and PR templates.

## [1.0.8]

- Last release as Hydrate Buddy.

[Unreleased]: https://github.com/MadhavanAR/Pingo/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/MadhavanAR/Pingo/compare/v1.0.8...v2.0.0
