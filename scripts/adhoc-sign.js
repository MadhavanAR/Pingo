/**
 * electron-builder afterPack hook: ad-hoc sign the macOS app bundle.
 *
 * Without a Developer ID certificate electron-builder skips signing, which
 * leaves Electron's original signature invalid once the bundle is modified.
 * Apple Silicon then reports the app as "damaged". An ad-hoc signature keeps
 * the bundle valid, so users only see the standard "Open Anyway" prompt.
 * Skipped when a real signing identity is configured (CSC_LINK).
 */
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin' || process.env.CSC_LINK) return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  console.log(`  • ad-hoc signed  ${appName}`);
};
