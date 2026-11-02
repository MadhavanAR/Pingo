/**
 * Generates the app / installer icon (build/icon.png, 256x256 — his face on a
 * rounded blue tile) and the tray icon (assets/tray.png, 64x64 — just his face)
 * from the boy's idle sprite.
 *
 *   node scripts/make-icon.js
 */
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const SIZE = 256;
const RADIUS = 52;
const BG = { r: 74, g: 163, b: 223 }; // #4aa3df
const SPRITE = path.join(__dirname, '..', 'assets', 'characters', 'boy', 'idle.png');

function insideRounded(x, y, s, r) {
  if (x >= r && x <= s - 1 - r) return true; // vertical band
  if (y >= r && y <= s - 1 - r) return true; // horizontal band
  const cx = x < r ? r : s - 1 - r;
  const cy = y < r ? r : s - 1 - r;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Square crop around his head: the top of the drawing, centred horizontally. */
function cropFace(sprite) {
  const w = sprite.bitmap.width;
  const h = sprite.bitmap.height;
  let top = 0;
  sprite.scan(0, 0, w, h, function (x, y, idx) {
    if (!top && this.bitmap.data[idx + 3] > 8) top = y; // first opaque row
  });
  const size = Math.min(Math.round(w * 0.62), h - top);
  const x = Math.max(0, Math.min(Math.round(w / 2 - size / 2), w - size));
  return sprite.clone().crop(x, top, size, size);
}

(async () => {
  const face = cropFace(await Jimp.read(SPRITE));

  const icon = new Jimp(SIZE, SIZE, 0x00000000);
  icon.scan(0, 0, SIZE, SIZE, function (x, y, idx) {
    if (insideRounded(x, y, SIZE, RADIUS)) {
      this.bitmap.data[idx] = BG.r;
      this.bitmap.data[idx + 1] = BG.g;
      this.bitmap.data[idx + 2] = BG.b;
      this.bitmap.data[idx + 3] = 255;
    }
  });
  const big = face.clone().resize(210, Jimp.AUTO);
  icon.composite(
    big,
    Math.round((SIZE - big.bitmap.width) / 2),
    Math.round((SIZE - big.bitmap.height) / 2),
  );

  const outDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(outDir, { recursive: true });
  await icon.writeAsync(path.join(outDir, 'icon.png'));
  console.log('Wrote build/icon.png (256x256).');

  await face
    .clone()
    .resize(64, 64)
    .writeAsync(path.join(__dirname, '..', 'assets', 'tray.png'));
  console.log('Wrote assets/tray.png (64x64).');
})();
