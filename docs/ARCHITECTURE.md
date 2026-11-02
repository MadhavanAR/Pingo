# Architecture

Pingo is an Electron app with no backend. Everything runs locally.

```
src/
  main/            Electron main process (Node.js)
    index.js       App bootstrap and PingoApp controller
    config.js      Static configuration and constants
    scheduler.js   Decides when a reminder is due
    clock.js       Time-zone-aware active-hours check
    store.js       Per-user settings (atomic JSON file)
    characters.js  Bundled and user-imported sprites
    windows.js     Pet window and settings dialogs
    tray.js        System tray icon and menu
    ipc.js         IPC handlers (validated, sender-checked)
    validation.js  Input normalisation shared by IPC and storage
  preload/
    index.js       contextBridge API exposed as window.pingo
  renderer/        HTML/CSS/JS for the pet and settings windows
  shared/
    channels.js    IPC channel names
test/              Unit tests (node:test, no Electron required)
website/           Static download page
scripts/           Asset generation and dev utilities
```

## Process model

`PingoApp` in `src/main/index.js` owns application state and wires the parts
together. Other modules receive their dependencies through constructors, which
keeps them testable without Electron:

- `Scheduler` polls every 30 seconds and compares against the wall clock. A
  single long `setTimeout` goes stale when the machine sleeps; polling does not.
  It emits `due` and `change` events and has an injectable clock.
- `Store` caches settings in memory and writes atomically (temp file and
  rename), so a crash cannot corrupt the config.
- `Characters` resolves which sprites are active and persists imported ones.
- `AppTray` holds no state. It renders from a controller interface and forwards
  clicks.

## Security

Renderer content is treated as untrusted:

- Every window runs with `contextIsolation`, `sandbox` and no `nodeIntegration`.
- Navigation and `window.open` are blocked. External `https:` links open in the
  system browser.
- IPC handlers reject senders outside the bundled `src/renderer/` directory.
- All IPC input is validated in the main process: names are length-capped and
  stripped of control characters, intervals are clamped, character keys are
  whitelisted, and imported images are size-limited and must be image data URLs.
- Each page sets a restrictive Content-Security-Policy. The app makes no network
  requests, and fonts are bundled.

The sandboxed preload cannot `require` local modules, so it repeats the channel
names from `src/shared/channels.js`. `test/channels.test.js` fails if they drift.

## Data

Settings live in the OS user-data folder (`%APPDATA%\Pingo`,
`~/Library/Application Support/Pingo` or `~/.config/Pingo`):

| File                  | Contents                                     |
| --------------------- | -------------------------------------------- |
| `config.json`         | name, interval, active character, setup flag |
| `custom-idle.png`     | Imported standing sprite                     |
| `custom-drinking.png` | Imported drinking sprite                     |

On first launch after the rename from Hydrate Buddy, these files are copied from
the old folder, so upgrading users keep their settings.

## Adding a new reminder type

The scheduler is not tied to water reminders. To add another habit (for example
stretch breaks), add a scheduler instance and its config in `PingoApp`, a
channel in `shared/channels.js` and its preload method, and the copy and poses
in `renderer/renderer.js`. The bundled character already includes `stretch`,
`rest` and `working` poses.
