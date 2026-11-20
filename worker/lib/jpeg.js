// Reads a JPEG's width and height from its header, so the Worker can tell a
// tall photo from a wide one without decoding it. Only the first few KB are
// fetched: the frame header sits near the start of the file, and the
// thumbnails upload-week.mjs writes carry no EXIF block in front of it.
// Those thumbnails are already rotated upright (sharp .rotate() at upload),
// so these numbers are how the photo actually displays.

const HEAD_BYTES = 32 * 1024;

// Start-of-frame markers carry the dimensions. C4 (huffman table), C8
// (reserved) and CC (arithmetic coding) share the range but aren't frames.
function isFrameMarker(m) {
  return m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
}

export function jpegSize(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    // Fill bytes and standalone markers have no length field.
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (isFrameMarker(marker)) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width && height ? { width, height } : null;
    }
    if (marker === 0xda) return null; // image data started, no frame found
    i += 2 + length;
  }
  return null;
}

// null when the object is missing or the header can't be read.
export async function readJpegSize(bucket, key) {
  const object = await bucket.get(key, { range: { offset: 0, length: HEAD_BYTES } });
  if (!object) return null;
  return jpegSize(new Uint8Array(await object.arrayBuffer()));
}
