<p align="center">
  <img src="build/icon.png" width="96" alt="Pingo" />
</p>

<h1 align="center">Pingo</h1>

<p align="center">
  Your desktop reminder buddy. Pingo walks onto your screen, reminds you, and walks off.
</p>

<p align="center">
  <a href="https://github.com/MadhavanAR/Pingo/actions/workflows/ci.yml"><img src="https://github.com/MadhavanAR/Pingo/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/MadhavanAR/Pingo/releases/latest"><img src="https://img.shields.io/github/v/release/MadhavanAR/Pingo" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" /></a>
</p>

![Pingo walks in, reminds you to drink water, celebrates, and walks off](docs/demo.gif)

Pingo lives in your system tray. On your schedule, a cartoon character walks into
the corner of your screen with a reminder: drink water by default, or anything
you write yourself. Press **Done** and it celebrates. Press **Snooze** and it
comes back later. Then it gets out of your way.

- **As many reminders as you like**: water, stretching, resting your eyes,
  posture, medicine, or your own words. Each has its own schedule, days, hours,
  snooze length and character.
- **Your schedule**: every _N_ minutes (1 minute to 12 hours) inside the hours you
  choose, or at set times of day (09:00 and 21:00), on the days you pick.
- **Your character**: three bundled characters, or make your own from any image
  or **animated GIF** in the avatar studio. Backgrounds are cut out
  automatically, with a strength control, size and mirror settings and a live
  preview.
- **Your look**: light, dark or match the system; a modern or retro pixel speech
  bubble; six accent colours; character size; either bottom corner; an optional
  sound; auto-snooze when you don't answer.
- **A home for it all**: one window shows what's next, today's done and
  snoozed counts and the week, and holds every setting. Pause for 30 minutes,
  an hour or until tomorrow from the tray.
- **Private**: no accounts, no telemetry, no network access. Settings stay on
  your machine.
- **Cross-platform**: Windows, macOS and Linux.

## Install

Get it from **[pingo-flax.vercel.app](https://pingo-flax.vercel.app)**, which picks the right
installer for your OS, or download it directly from the
[latest release](https://github.com/MadhavanAR/Pingo/releases/latest):

| Platform | File                                                                 |
| -------- | -------------------------------------------------------------------- |
| Windows  | `Pingo-Setup-<version>.exe`                                          |
| macOS    | `Pingo-mac-arm64.dmg` (Apple Silicon) or `Pingo-mac-x64.dmg` (Intel) |
| Linux    | `.AppImage` or `.deb`                                                |

Builds are not code-signed yet, so the first launch needs one extra click:

- **Windows:** on "Windows protected your PC", choose **More info → Run anyway**.
- **macOS:** open the DMG and drag Pingo into Applications. On first launch, if macOS
  blocks it, go to **System Settings → Privacy & Security → Open Anyway**.
- **Linux:** make the AppImage executable, or run `sudo apt install ./Pingo-*.deb`.

On first launch, a short three-step setup asks for your name, what to remind you
about, how often, and a character.

<p align="center">
  <img src="docs/setup-name.png" width="400" height="308" alt="Setup step 1: your name" />
  <img src="docs/setup-interval.png" width="400" height="308" alt="Setup step 2: what to remind you about, and how often" />
</p>

## Usage

Right-click the tray icon for:

| Menu item        | Action                                                    |
| ---------------- | --------------------------------------------------------- |
| Next: …          | What's coming up (or how long Pingo is paused)            |
| Remind me now    | Show the next reminder immediately                        |
| Open Pingo…      | The control center: Home, Reminders, Avatars, Appearance  |
| New reminder…    | Start a new reminder                                      |
| Avatars…         | Pick a character or make your own                         |
| Pause / Resume   | 30 min, 1 hour, 2 hours, until tomorrow, or until resumed |
| Start at login   | Launch automatically (installed builds)                   |
| Run setup again… | Re-open the first-launch wizard                           |

### Control center

| View       | What's there                                                             |
| ---------- | ------------------------------------------------------------------------ |
| Home       | What's next, done and snoozed today, the last seven days, pause          |
| Reminders  | Every reminder with an on/off switch; templates; an editor for each      |
| Avatars    | Bundled and your own characters; the avatar studio for images and GIFs   |
| Appearance | Theme, bubble style, accent, size, corner and screen, sound, auto-snooze |
| General    | Your name, pause, start at login, setup, about                           |

Every change saves itself. Each reminder has a **Show it on my screen** button
that previews it without touching the schedule.

### Reminder defaults

| Setting      | Default          | Notes                                              |
| ------------ | ---------------- | -------------------------------------------------- |
| Kind         | Drink water      | Or stretch, eyes, posture, medicine, custom text   |
| When         | Every 45 minutes | 1 minute to 12 hours, or up to 12 set times a day  |
| Days         | Every day        | Any combination                                    |
| Active hours | 10:00–23:00      | Your time zone; can wrap past midnight, or all day |
| Snooze for   | 10 minutes       | 1 to 120 minutes                                   |

Up to 50 reminders and 24 custom avatars. To draw your own character with an AI
image tool, see [Make your own character](docs/make-your-own-character.md).

## Troubleshooting

- **The character never appears.** Every-few-minutes reminders only show during
  their active hours (10:00 to 23:00 by default) and on their days. Check the
  reminder in **Open Pingo… → Reminders**, or press **Show it on my screen**.
- **No welcome screen after upgrading.** Your settings were kept. Use **Run setup
  again…** from the tray.
- **An imported character shows as a rectangle.** The source image needs a plain,
  solid-colour background; raise **Strength** in the avatar studio. GIFs are kept
  as they are, so use one with a transparent background.
- **Start at login when running from source (Windows).** Run
  `npm run autostart:enable`, or `npm run autostart:disable` to undo.

## Development

Requirements: Node.js 22+ (see `.nvmrc`).

```bash
git clone https://github.com/MadhavanAR/Pingo.git
cd Pingo
npm install
npm start
```

| Command                            | Purpose                                     |
| ---------------------------------- | ------------------------------------------- |
| `npm start`                        | Run the app from source                     |
| `PINGO_USER_DATA=/tmp/p npm start` | Run from source with a throwaway profile    |
| `npm run check`                    | Lint, format check and unit tests (CI gate) |
| `npm test`                         | Unit tests only                             |
| `npm run lint:fix`                 | Auto-fix lint issues                        |
| `npm run format`                   | Format all files with Prettier              |
| `npm run dist:win`                 | Build the Windows installer into `dist/`    |
| `npm run dist:mac`                 | Build the macOS DMG (run on macOS)          |
| `npm run dist:linux`               | Build AppImage and .deb                     |

The codebase layout and design decisions are described in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Defaults

Defaults and limits live in [`src/main/settings.js`](src/main/settings.js)
(appearance and name) and [`src/main/reminders.js`](src/main/reminders.js)
(each reminder). Fixed timings, such as the poll
interval, are in [`src/main/config.js`](src/main/config.js).

## Releasing

Releases are built by [GitHub Actions](.github/workflows/release.yml) for all
three platforms when a version tag is pushed:

```bash
npm version minor        # bumps package.json and creates the tag
git push --follow-tags
```

The workflow fails if the tag does not match `package.json`. Update
[CHANGELOG.md](CHANGELOG.md) before tagging.

## Website

`website/` is a static download page with no build step. It deploys to Vercel,
GitHub Pages, Hostinger, AWS S3/CloudFront or any static host. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). To report a vulnerability, follow
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). The bundled Press Start 2P font is licensed under the
[SIL Open Font License 1.1](assets/fonts/OFL.txt).
