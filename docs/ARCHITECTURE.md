# Architecture

Pingo is an Electron app with no backend. Everything runs locally.

```
src/
  main/            Electron main process (Node.js)
    index.js       App bootstrap and PingoApp controller
    config.js      Static configuration and constants
    settings.js    App-wide settings (name, appearance): defaults, validation
    reminders.js   Reminder model, validation, legacy migration, next-due maths
    scheduler.js   Tracks every reminder's next time; decides which is due
    stats.js       Per-day done/snoozed counts for the Home view
    clock.js       Time-zone-aware active-hours check
    store.js       Per-user settings (atomic JSON file)
    characters.js  Bundled characters and user avatars (images and GIFs)
    windows.js     Pet window and settings dialogs
    tray.js        System tray icon and menu
    ipc.js         IPC handlers (validated, sender-checked)
    validation.js  Image data-URL validation (checks the file's real bytes)
  preload/
    index.js       contextBridge API exposed as window.pingo
  renderer/        HTML/CSS/JS for the pet, control center and setup wizard
    ui.css         Design tokens and controls shared by app and onboarding
    common.js      Reminder copy, formatting, DOM builder, icons, sounds
    app.*          Control center (hash-routed views)
    image-tools.js Background cut-out and cropping for avatars
    index.html     The pet: renderer.js + style.css
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

- `Scheduler` keeps a next-due time per reminder and polls every 30 seconds
  against the wall clock. A single long `setTimeout` goes stale when the machine
  sleeps; polling does not. One reminder is on screen at a time; the most
  overdue goes first and the rest wait for the next tick. Editing a reminder
  restarts only its own countdown. It emits `due` and `change` and has an
  injectable clock. The timing maths (`nextDue`, days, hours that wrap past
  midnight) is pure and lives in `reminders.js`.
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
- All IPC input is validated in the main process. Settings go through
  `normalizeSettings`, which cleans text, clamps numbers and drops unknown
  fields. Character keys are whitelisted, and imported images are size-limited
  and must be image data URLs.
- Each page sets a restrictive Content-Security-Policy. The app makes no network
  requests, and fonts are bundled.

The sandboxed preload cannot `require` local modules, so it repeats the channel
names from `src/shared/channels.js`. `test/channels.test.js` fails if they drift.

## Data

Settings live in the OS user-data folder (`%APPDATA%\Pingo`,
`~/Library/Application Support/Pingo` or `~/.config/Pingo`):

| File                           | Contents                                             |
| ------------------------------ | ---------------------------------------------------- |
| `config.json`                  | settings, reminders, avatar list, 14 days of counts  |
| `avatars/<id>-idle.<ext>`      | A user avatar's standing image (PNG, GIF, WebP, JPG) |
| `avatars/<id>-celebrate.<ext>` | Its optional celebration image                       |

Older versions stored one reminder as flat settings (`message`, `intervalMin`…)
and one custom character as `custom-idle.png`/`custom-drinking.png`. Both are
migrated on first launch. Before that, files from the Hydrate Buddy folder are
copied over, so upgrading users keep everything.

## Adding a new reminder type

Add the type to `TYPES` in `src/main/reminders.js` (its label and celebration
pose) and to `REMINDER_TYPES` in `src/renderer/common.js` (its label, Done
button text, prompts and cheers), then a starting schedule in
`TEMPLATE_DEFAULTS` in `src/renderer/app.js`. The bundled characters already
include `stretch`, `rest`, `working` and other poses.
