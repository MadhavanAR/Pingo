'use strict';

/** Image types we accept, by mime, with the extension they are saved under. */
const IMAGE_TYPES = Object.freeze({
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
});

/** Magic bytes, so a renamed file of another kind can't be saved as an image. */
function sniffMime(buf) {
  if (buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47) return 'image/png';
  if (buf.length >= 6 && buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}

/** Decode a base64 `data:image/...` URL; returns null for anything else. */
function dataUrlToBuffer(dataUrl, maxBytes = Infinity) {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:image\/[\w+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  // Reject before decoding: base64 inflates size by 4/3.
  if ((match[1].length * 3) / 4 > maxBytes) return null;
  const buf = Buffer.from(match[1], 'base64');
  return buf.length > 0 && buf.length <= maxBytes ? buf : null;
}

/**
 * Decode an image data URL whose bytes really are PNG, GIF, WebP or JPEG.
 * Animated GIF and WebP pass through untouched.
 *
 * @returns {{ buffer: Buffer, mime: string, ext: string } | null}
 */
function parseImageDataUrl(dataUrl, maxBytes = Infinity) {
  const buffer = dataUrlToBuffer(dataUrl, maxBytes);
  if (!buffer) return null;
  const mime = sniffMime(buffer);
  return mime ? { buffer, mime, ext: IMAGE_TYPES[mime] } : null;
}

module.exports = { IMAGE_TYPES, dataUrlToBuffer, parseImageDataUrl, sniffMime };
