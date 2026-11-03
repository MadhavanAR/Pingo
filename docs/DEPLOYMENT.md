# Deployment

Pingo has two deliverables:

1. **The desktop app**, built by CI and published as installers on GitHub
   Releases. It is an Electron app, so it runs on users' machines rather than on
   a web host.
2. **The website** in `website/`, a static download page. It has no build step,
   no server and no environment variables, so any static host works.

Before deploying, set where the installers live in `website/config.js`:

```js
window.PINGO_SITE = { downloads: 'https://example.com/pingo/latest' };
```

That folder must hold `Pingo-mac-arm64.dmg`, `Pingo-mac-x64.dmg` and
`Pingo-Setup.exe`, and be public: while the source repo is private, its own
GitHub Releases links 404 for visitors. Each button links straight to its file,
with the visitor's OS first.

## Desktop app (GitHub Releases)

```bash
npm version minor
git push --follow-tags
```

The `Release` workflow verifies the build, then produces:

| Runner  | Artifacts                          |
| ------- | ---------------------------------- |
| Windows | `Pingo-Setup.exe`                  |
| macOS   | `.dmg` for Intel and Apple Silicon |
| Linux   | `.AppImage`, `.deb`                |

**Code signing (recommended for production):** add `CSC_LINK` and
`CSC_KEY_PASSWORD` as repository secrets and remove
`CSC_IDENTITY_AUTO_DISCOVERY: 'false'` from `release.yml`. macOS notarisation
also needs `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`. See
the [electron-builder docs](https://www.electron.build/code-signing).

## Website

### Vercel (free)

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `website`.
3. Set **Framework Preset** to _Other_ and leave the build command empty.
4. Deploy.

Or from the CLI:

```bash
cd website
npx vercel --prod
```

`website/vercel.json` sets security headers and asset caching.

### GitHub Pages (free)

1. **Settings → Pages → Source**: _GitHub Actions_.
2. **Settings → Secrets and variables → Actions → Variables**: add
   `ENABLE_PAGES` = `true`.
3. Push a change under `website/`, or run the _Website (GitHub Pages)_ workflow
   manually.

### Hostinger, cPanel and other shared hosting

1. Open **File Manager**, or connect over FTP/SFTP.
2. Upload the **contents** of `website/` (not the folder itself) into
   `public_html/`. Include the hidden `.htaccess` file.
3. Enable SSL for the domain in the hosting panel.

`.htaccess` adds security headers and caching, forces HTTPS, and disables
directory listings. It works on Apache and LiteSpeed.

### AWS (S3 and CloudFront)

One-time setup:

1. Create an S3 bucket and keep _Block all public access_ on.
2. Create a CloudFront distribution with the bucket as origin, using
   **Origin Access Control**, and set the default root object to `index.html`.
3. Optional: attach an ACM certificate and a Route 53 alias for your domain.
4. Optional: add a CloudFront _Response headers policy_ that matches the headers
   in `website/vercel.json`.

Deploy:

```bash
S3_BUCKET=pingo-site CLOUDFRONT_DISTRIBUTION_ID=E1234567890 ./scripts/deploy-aws.sh
```

### Any other host

Netlify, Cloudflare Pages, Render, Firebase Hosting, nginx and similar hosts all
work. Point them at `website/` as the publish directory with no build command.
