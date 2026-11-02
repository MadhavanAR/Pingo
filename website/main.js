'use strict';

(function () {
  const { repo } = window.PINGO_SITE;
  const repoUrl = `https://github.com/${repo}`;
  const latestRelease = `${repoUrl}/releases/latest`;

  // Asset names must match `artifactName` in package.json.
  const platforms = {
    windows: { label: 'Download for Windows', pattern: /\.exe$/i },
    mac: { label: 'Download for macOS', pattern: /\.dmg$/i },
    linux: { label: 'Download for Linux', pattern: /\.AppImage$/i },
  };

  function detectPlatform() {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return 'windows';
    if (/Mac OS X|Macintosh/i.test(ua)) return 'mac';
    if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return 'linux';
    return null;
  }

  document.querySelectorAll('[data-repo-link]').forEach((a) => (a.href = repoUrl));

  const button = document.querySelector('[data-download]');
  button.href = latestRelease;
  const platform = platforms[detectPlatform()];
  if (!platform) return;
  button.textContent = platform.label;

  // Link straight to the installer when the GitHub API is reachable; the
  // releases page remains the fallback (e.g. when rate-limited).
  fetch(`https://api.github.com/repos/${repo}/releases/latest`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
    .then((release) => {
      const asset = release.assets.find((a) => platform.pattern.test(a.name));
      if (asset) button.href = asset.browser_download_url;
      const note = document.querySelector('[data-platform-note]');
      if (note && release.tag_name) note.textContent = `Latest: ${release.tag_name}`;
    })
    .catch(() => {});
})();
