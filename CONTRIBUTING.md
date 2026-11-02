# Contributing to Pingo

Thanks for helping out. This guide covers how to get a change merged.

## Ground rules

- Open an issue before starting large changes, so we can agree on the approach.
- Keep pull requests focused. One logical change per PR.
- Be respectful. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

```bash
nvm use            # Node 22, from .nvmrc
npm install
npm start
```

## Before you open a PR

```bash
npm run check      # lint, format check and unit tests
```

CI runs the same command on Windows, macOS and Linux.

## Code standards

- **Structure.** Main-process logic belongs in a focused module under
  `src/main/`. Keep Electron APIs at the edges (`index.js`, `windows.js`,
  `tray.js`, `ipc.js`) so the rest stays unit-testable.
- **Security.** Never enable `nodeIntegration` or disable `sandbox` or
  `contextIsolation`. Validate every IPC argument in the main process. Do not
  build DOM from strings with `innerHTML`.
- **IPC.** Add new channels to `src/shared/channels.js`, the preload, and
  `src/main/ipc.js`. The channel test checks all three.
- **Tests.** New logic in `src/main/` needs tests in `test/`, using `node:test`.
- **Comments.** Explain why, not what. Remove commented-out code.
- **Formatting.** Prettier is authoritative, so don't hand-format.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scheduler): support quiet hours on weekends
fix(tray): refresh tooltip after unpausing
docs: clarify Hostinger upload steps
```

## Adding a character

Bundled characters live in `assets/characters/<key>/`, with one PNG per pose
(see `POSE_NAMES` in `src/main/config.js`). Every character needs `idle.png` and
`drink.png`. Missing poses fall back to the wave or idle sprite.

To slice a pose sheet, put it in `assets/characters/<key>/raw/sheet.png` with a
`layout.json` beside it (the format is documented at the top of the script, and
the existing characters are working examples), then run:

```bash
pip install rembg onnxruntime pillow numpy scipy
python3 scripts/slice-poses-ai.py <key>
```

Register the character in `PRESETS`. `raw/` is excluded from installers.
Artwork must be your own or carry a licence compatible with MIT.

## Releases

Maintainers update `CHANGELOG.md`, run `npm version <patch|minor|major>`, and
push with `--follow-tags`. CI builds and publishes the installers.
