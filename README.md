<p align="center">
  <img src="build/icon.png" width="88" alt="Pingo" />
</p>

<h1 align="center">Reminders that walk in.</h1>

<p align="center">
  <b>Pingo</b>, your little buddy for Mac and Windows.
</p>

<p align="center">
  <a href="https://pingo-flax.vercel.app"><img src="https://img.shields.io/badge/Download_for_Mac-0a8a64?style=for-the-badge&logo=apple&logoColor=white" alt="Download for Mac" /></a>
  <a href="https://pingo-flax.vercel.app"><img src="https://img.shields.io/badge/Download_for_Windows-1d1d1f?style=for-the-badge&logo=windows&logoColor=white" alt="Download for Windows" /></a>
</p>

<p align="center">
  <a href="https://github.com/MadhavanAR/Pingo/actions/workflows/ci.yml"><img src="https://github.com/MadhavanAR/Pingo/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/MadhavanAR/Pingo/releases/latest"><img src="https://img.shields.io/github/v/release/MadhavanAR/Pingo?color=0a8a64" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0a8a64.svg" alt="MIT license" /></a>
</p>

<p align="center">
  <img src="website/assets/poses/wave.webp" height="120" alt="Pingo waving" />
  <img src="website/assets/poses/drink.webp" height="120" alt="Pingo drinking water" />
  <img src="website/assets/poses/stretch.webp" height="120" alt="Pingo stretching" />
  <img src="website/assets/poses/rest.webp" height="120" alt="Pingo resting their eyes" />
  <img src="website/assets/poses/happy.webp" height="120" alt="Pingo celebrating" />
</p>

---

**Pingo walks onto your screen, reminds you, and walks off.**
Press **Done** and it cheers. Press **Snooze** and it comes back later.

![Pingo walks in, reminds you to drink water, celebrates, and walks off](docs/demo.gif)

### Water. Stretch. Rest eyes. Medicine. Your own.

- **Any reminder, any schedule.** Every few minutes or at set times, on your days.
- **Your character.** Pick one, or make your own from any image or GIF.
- **Out of your way.** Lives in the tray. Pause it anytime.
- **Private.** No accounts. No tracking. No network.
- **Free.** Open source, MIT licensed.

<p align="center">
  <img src="website/assets/demo/app-light-v6.webp" width="720" alt="The Pingo app: opening Reminders, choosing a stretch reminder, changing how often it repeats, adding Saturday, and previewing it" />
</p>

## Two steps. Thirty seconds.

Download from **[pingo-flax.vercel.app](https://pingo-flax.vercel.app)** or the
[latest release](https://github.com/MadhavanAR/Pingo/releases/latest).

|             | 1                             | 2                                                   |
| ----------- | ----------------------------- | --------------------------------------------------- |
| **Mac**     | Drag Pingo into Applications. | First launch: **Privacy & Security → Open Anyway**. |
| **Windows** | Run `Pingo-Setup.exe`.        | On the blue warning: **More info → Run anyway**.    |

Step 2 is needed once, because builds aren't code-signed yet.
Linux: `.AppImage` or `sudo apt install ./Pingo-*.deb`.

## Develop

```bash
git clone https://github.com/MadhavanAR/Pingo.git && cd Pingo
npm install && npm start
```

`npm run check` runs lint, format and tests. `npm run dist:mac`, `dist:win` and
`dist:linux` build installers. Node.js 22+. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it fits together.

**Release:** update [CHANGELOG.md](CHANGELOG.md), then
`npm version minor && git push --follow-tags`. GitHub Actions builds every platform.

**Website:** `website/` is the static landing page, no build step. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).
Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Bundled fonts: [SIL OFL 1.1](assets/fonts/OFL.txt).

<p align="center">
  <img src="website/assets/poses/walking.webp" height="72" alt="Pingo walking off" /><br />
  <sub>Designed and built by <a href="https://www.linkedin.com/in/madhavanar/">Madhavan</a>.</sub>
</p>
