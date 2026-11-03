'use strict';

/* eslint-disable no-unused-vars -- globals used by app.js */

/**
 * Turns a picked image into a character sprite: cuts out a plain background
 * (flood fill from the edges, so the character's own colours survive) and
 * crops to the character. Animated GIF and WebP files are kept exactly as
 * they are, since drawing them to a canvas would freeze them on one frame.
 */

const isAnimatedFormat = (dataUrl) => /^data:image\/(gif|webp);/.test(dataUrl);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Clear every pixel connected to the edges whose colour is near the corners'. */
function removeBackground(imageData, w, h, tolerance) {
  const data = imageData.data;
  const at = (x, y) => (y * w + x) * 4;
  let br = 0;
  let bg = 0;
  let bb = 0;
  for (const [cx, cy] of [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ]) {
    const i = at(cx, cy);
    br += data[i];
    bg += data[i + 1];
    bb += data[i + 2];
  }
  br /= 4;
  bg /= 4;
  bb /= 4;
  const tol2 = tolerance * tolerance;
  const visited = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + (w - 1));
  while (stack.length) {
    const p = stack.pop();
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    const dr = data[i] - br;
    const dg = data[i + 1] - bg;
    const db = data[i + 2] - bb;
    if (dr * dr + dg * dg + db * db > tol2) continue;
    data[i + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    if (x + 1 < w) stack.push(p + 1);
    if (x > 0) stack.push(p - 1);
    if (y + 1 < h) stack.push(p + w);
    if (y > 0) stack.push(p - w);
  }
}

function boundingBox(imageData, w, h) {
  const data = imageData.data;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return { x: 0, y: 0, w, h };
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * @param {string} dataUrl the picked image
 * @param {{ cutout: boolean, strength: number }} options strength 0–100
 * @returns {Promise<string>} a PNG data URL, or the original for animations
 */
async function processSprite(dataUrl, { cutout, strength }) {
  if (isAnimatedFormat(dataUrl)) return dataUrl;
  const img = await loadImage(dataUrl);
  const maxDim = 1000;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const cornerAlpha =
    (d[3] + d[(w - 1) * 4 + 3] + d[(h - 1) * w * 4 + 3] + d[((h - 1) * w + (w - 1)) * 4 + 3]) / 4;
  // Only images with an opaque background have one to cut out.
  if (cutout && cornerAlpha > 200) {
    removeBackground(imageData, w, h, 20 + (Math.max(0, Math.min(100, strength)) / 100) * 110);
  }
  ctx.putImageData(imageData, 0, 0);
  const box = boundingBox(imageData, w, h);
  const out = document.createElement('canvas');
  out.width = box.w;
  out.height = box.h;
  out.getContext('2d').drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return out.toDataURL('image/png');
}

/** Read a dropped File as a data URL. */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
