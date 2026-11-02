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
the corner of your screen and reminds you to drink water. Press **Yes, I drank**
and it celebrates. Press **Snooze** and it comes back in 10 minutes. Then it gets
out of your way.

- **Configurable cadence**: any interval from 1 minute to 12 hours, active only
  during waking hours.
- **Personal**: greets you by name. You can import your own character and the
  background is removed automatically.
- **Private**: no accounts, no telemetry, no network access. Settings stay on
  your machine.
- **Cross-platform**: Windows, macOS and Linux.

## Install

Download the installer for your platform from the
[latest release](https://github.com/MadhavanAR/Pingo/releases/latest):

| Platform | File                        |
| -------- | --------------------------- |
| Windows  | `Pingo-Setup-<version>.exe` |
| macOS    | `Pingo-<version>-mac-*.dmg` |
| Linux    | `.AppImage` or `.deb`       |

Builds are not code-signed yet. On Windows, SmartScreen will warn you, so choose
**More info → Run anyway**. On macOS, right-click the app and choose **Open** the
first time.

On first launch, a short three-step setup asks for your name, your reminder
interval and a character. You can change any of these later from the tray icon.

<p align="center">
  <img src="docs/setup-name.png" width="400" height="308" alt="Setup step 1: your name" />
  <img src="docs/setup-interval.png" width="400" height="308" alt="Setup step 2: reminder interval" />
</p>

## Usage

Right-click the tray icon for:

| Menu item              | Action                                      |
| ---------------------- | ------------------------------------------- |
| Drink now              | Show a reminder immediately                 |
| Set up…                | Re-run the first-launch setup               |
| Set your name…         | Change how Pingo greets you                 |
| Reminder every _N_ min | Choose a preset or custom interval          |
| Change character…      | Pick a bundled character or import your own |
| Pause reminders        | Stop reminders until unpaused               |
| Start at login         | Launch automatically (installed builds)     |

To use your own character, see [Make your own character](docs/make-your-own-character.md).

## Troubleshooting

- **The character never appears.** Reminders only show during active hours
  (10:00 to 23:00 IST by default). Use **Drink now** from the tray to test.
- **No welcome screen after upgrading.** Your settings were kept. Use **Set up…**
  from the tray to run it again.
- **An imported character shows as a rectangle.** The source image needs a plain,
  solid-colour background.
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

| Command              | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `npm start`          | Run the app from source                     |
| `npm run check`      | Lint, format check and unit tests (CI gate) |
| `npm test`           | Unit tests only                             |
| `npm run lint:fix`   | Auto-fix lint issues                        |
| `npm run format`     | Format all files with Prettier              |
| `npm run dist:win`   | Build the Windows installer into `dist/`    |
| `npm run dist:mac`   | Build the macOS DMG (run on macOS)          |
| `npm run dist:linux` | Build AppImage and .deb                     |

The codebase layout and design decisions are described in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Configuration

Timing defaults live in [`src/main/config.js`](src/main/config.js):

| Setting                | Default        | Meaning                         |
| ---------------------- | -------------- | ------------------------------- |
| `TIME_ZONE`            | `Asia/Kolkata` | Zone used for active hours      |
| `ACTIVE_START_HOUR`    | `10`           | First hour reminders may appear |
| `ACTIVE_END_HOUR`      | `23`           | Reminders stop at this hour     |
| `DEFAULT_INTERVAL_MIN` | `45`           | Interval for new users          |
| `SNOOZE_MIN`           | `10`           | Snooze length                   |

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
