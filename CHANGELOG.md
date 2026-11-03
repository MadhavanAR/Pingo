# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.2.0] - 2026-11-03

### Added

- **Any number of reminders**, each with its own kind (water, stretch, rest your
  eyes, posture, medicine, custom), message, schedule, days of the week, active
  hours, snooze length and character.
- **Set times**: remind at fixed times of day (for example 09:00 and 21:00) as
  well as every _N_ minutes.
- **Avatar studio**: make characters from any image or **animated GIF**, with an
  optional celebration image, background cut-out strength, size, mirroring and a
  live preview. Keep up to 24.
- **Appearance**: a light look that matches the website; modern or retro pixel bubble;
  accent colour; character size; bottom-left or bottom-right corner; main screen
  or the screen with the pointer; arrival sound; auto-snooze if unanswered.
- **Control center** window with Home (what's next, today's counts, the week),
  Reminders, Avatars, Appearance and General.
- Pause for 30 minutes, 1 or 2 hours, until tomorrow, or until resumed.

### Changed

- The Settings and Change character windows are replaced by the control center,
  and the setup wizard is redesigned. Existing settings and custom characters
  carry over.
- The app uses bundled Instrument Sans and Instrument Serif fonts.

## [2.1.0] - 2026-11-02

### Added

- **Settings window** (tray → Settings…) for name, reminder text, interval,
  active hours and snooze length. Nothing needs code changes any more.
- **Custom reminders**: write your own message ("Take your medicine"). The popup
  shows a **Done** button and a matching celebration.
- Active hours can wrap past midnight, or be turned off ("Any time of day").
- The website has a step-by-step install guide for each OS.

### Changed

- Active hours use the computer's own time zone instead of always using IST.
- The tray menu is simpler. The separate name and interval windows are replaced
  by Settings.

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

[Unreleased]: https://github.com/MadhavanAR/Pingo/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/MadhavanAR/Pingo/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/MadhavanAR/Pingo/compare/v1.0.8...v2.0.0
