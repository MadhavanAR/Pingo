/**
 * Removes the "launch at login" launcher from the Windows Startup folder.
 * Also cleans up the launcher left by pre-rename (Hydrate Buddy) versions.
 *
 *   npm run autostart:disable
 */
const fs = require('fs');
const path = require('path');

if (process.platform !== 'win32') {
  console.log('Nothing to remove (auto-start automation is Windows-only).');
  process.exit(0);
}

const startupDir = path.join(
  process.env.APPDATA,
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup',
);

let removed = 0;
for (const file of ['Pingo.vbs', 'Nudgy.vbs', 'HydrateBuddy.vbs']) {
  const vbsPath = path.join(startupDir, file);
  if (fs.existsSync(vbsPath)) {
    fs.unlinkSync(vbsPath);
    console.log('✔ Auto-start disabled — removed ' + vbsPath);
    removed++;
  }
}
if (!removed) console.log('Auto-start was not enabled (no launcher found).');
