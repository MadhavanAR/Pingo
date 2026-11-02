'use strict';

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

module.exports = { dataUrlToBuffer };
