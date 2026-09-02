#!/usr/bin/env node
// Uploads one named group of photos for one week to R2, generating a
// thumbnail for each and stripping EXIF/GPS metadata from the originals. Run
// once per group per week, see README.md for usage.
//
//   node upload-week.mjs --year 2026 --week 3 --date 2026-09-11 \
//     --level varsity --dir ~/Photos/wk3-varsity --caption "vs. Fox, W 28-14"
//
// Photos are ordered by EXIF capture time, not filename, and stored under a
// numbered key that preserves that order (see ORDINAL_WIDTH below). Add
// --dry-run to print the resulting order and exit without uploading or
// needing credentials — worth doing before a long run.
//
// --level is usually a roster level (varsity/jv/freshman), but it's really
// just the folder name the site groups these photos under and shows as a
// tab — for a week that isn't split by roster level, e.g. a scrimmage, use
// whatever name fits instead, such as "instagram" and "full":
//
//   node upload-week.mjs --year 2026 --week 0 --date 2026-08-15 \
//     --level instagram --dir ~/Photos/scrimmage-ig --caption "Blue & Gold Scrimmage"
//   node upload-week.mjs --year 2026 --week 0 --date 2026-08-15 \
//     --level full --dir ~/Photos/scrimmage-all --caption "Blue & Gold Scrimmage"

import { parseArgs } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import sharp from "sharp";
import exifReader from "exif-reader";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Not a fixed enum — see the --level note above. This just keeps the value
// safe to drop into an R2 key and a URL segment, matching the server's
// isValidLevel (worker/lib/validate.js).
const LEVEL_RE = /^[a-z0-9-]{1,32}$/;
const THUMB_WIDTH = 640;
// What the lightbox actually displays. The originals are full-resolution
// camera files (several MB each); serving those just to fill a phone screen
// burns cellular data for no visible gain, so we ship this instead and keep
// the original behind the Download button.
const VIEW_WIDTH = 1600;
const IMAGE_EXT = /\.(jpe?g)$/i;

// Encoder settings for the downloadable original. mozjpeg's trellis
// quantization buys a lot here: measured over four 6960x4640 frames spanning
// one game's lighting, this lands ~49% smaller than the previous
// {quality: 95, chromaSubsampling: "4:4:4"} at 38.4 dB PSNR against the
// source — still comfortably past the point where re-encode loss is visible,
// and *better* quality than plain quality-88 while also being smaller.
// Dropping 4:4:4 (i.e. using the standard 4:2:0) is where much of the saving
// comes from and costs nothing perceptible on photographic content.
// A full game at 6960x4640 is ~1 GB of originals rather than ~2 GB.
const JPEG_ORIGINAL = { quality: 92, mozjpeg: true };

// Photos appear on the site in R2 key order — the Worker sorts by key
// (worker/lib/r2.js) and never sees the order we upload in — so the sequence
// has to be baked into the stored name. Camera filenames can't be trusted for
// that: an export can number the last frame of the game lowest, and a counter
// can roll over from IMG_9999 to IMG_0001 mid-game. So we order by EXIF
// capture time and prefix each key with its position.
const ORDINAL_WIDTH = 4;

// EXIF DateTimeOriginal only resolves to the second, which a burst blows
// through several times over; SubSecTimeOriginal holds the fractional part.
// Returns null when there's no readable capture time.
function captureTime(exifBuffer) {
  if (!exifBuffer) return null;

  let parsed;
  try {
    parsed = exifReader(exifBuffer);
  } catch {
    return null;
  }

  const taken = parsed?.Photo?.DateTimeOriginal;
  if (!(taken instanceof Date) || Number.isNaN(taken.getTime())) return null;

  // "35" means .35 of a second, not 35ms.
  const fraction = Number.parseFloat(`0.${String(parsed?.Photo?.SubSecTimeOriginal ?? "").trim()}`);
  return taken.getTime() + (Number.isNaN(fraction) ? 0 : fraction * 1000);
}

// Frames shot in the same burst can share a capture time down to the
// subsecond, so the filename is the tiebreaker — but only once we know which
// direction the filenames run. Walking the capture times in filename order
// answers that: mostly-decreasing means the numbering is backwards.
function filenamesRunBackwards(entriesInNameOrder) {
  const timed = entriesInNameOrder.filter((e) => e.time !== null);
  let forward = 0;
  let backward = 0;
  for (let i = 1; i < timed.length; i++) {
    const delta = timed[i].time - timed[i - 1].time;
    if (delta > 0) forward += 1;
    else if (delta < 0) backward += 1;
  }
  return backward > forward;
}

// `force` comes from --reverse, for exports that stripped EXIF entirely (some
// Lightroom/Photoshop presets remove all camera metadata, which is also what
// takes the GPS out). With no capture times there's nothing to detect from,
// so the direction has to be stated.
function orderPhotos(entriesInNameOrder, force = null) {
  const backwards = force ?? filenamesRunBackwards(entriesInNameOrder);
  const byName = (a, b) =>
    backwards ? b.fileName.localeCompare(a.fileName) : a.fileName.localeCompare(b.fileName);

  return {
    backwards,
    ordered: [...entriesInNameOrder].sort((a, b) => {
      // A frame with no capture time can't be placed against the others, so
      // group those at the end rather than guessing a spot mid-game.
      if (a.time === null || b.time === null) {
        if (a.time !== b.time) return a.time === null ? 1 : -1;
        return byName(a, b);
      }
      return a.time - b.time || byName(a, b);
    }),
  };
}

// "IMG_0412.jpg" -> "0007_IMG_0412.jpg". The camera's name is kept so a photo
// stays traceable back to the original file on disk.
function storedName(entry, index) {
  return `${String(index + 1).padStart(ORDINAL_WIDTH, "0")}_${entry.fileName}`;
}

const { values } = parseArgs({
  options: {
    year: { type: "string" },
    week: { type: "string" },
    date: { type: "string" },
    level: { type: "string" },
    dir: { type: "string" },
    caption: { type: "string" },
    "dry-run": { type: "boolean" },
    reverse: { type: "boolean" },
  },
});

for (const key of ["year", "week", "date", "level", "dir"]) {
  if (!values[key]) {
    console.error(`Missing required --${key}`);
    process.exit(1);
  }
}

const { year, week, date, level, dir } = values;

if (!/^\d{4}$/.test(year)) {
  console.error("--year must be a 4-digit year, e.g. 2026");
  process.exit(1);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("--date must be YYYY-MM-DD, e.g. 2026-09-11");
  process.exit(1);
}
if (!LEVEL_RE.test(level)) {
  console.error("--level must be lowercase letters, numbers, and hyphens only, e.g. varsity, jv, freshman, instagram, full");
  process.exit(1);
}

const weekNum = String(parseInt(week, 10)).padStart(2, "0");
const weekFolder = `week-${weekNum}_${date}`;
const weekRootPrefix = `${year}/${weekFolder}/`;
const prefix = `${weekRootPrefix}${level}/`;

// A dry run only reads local files, so don't make it wait on credentials.
if (!values["dry-run"]) {
  const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing ${key} in scripts/.env — copy .env.example and fill it in.`);
      process.exit(1);
    }
  }
}

const s3 = values["dry-run"]
  ? null
  : new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

async function main() {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && IMAGE_EXT.test(e.name))
    .map((e) => e.name)
    .sort();

  if (files.length === 0) {
    console.error(`No .jpg/.jpeg files found in ${dir}`);
    process.exit(1);
  }

  // Only the JPEG header is read here, not the whole frame, so this pass is
  // cheap even on a few hundred full-resolution files.
  process.stdout.write(`Reading capture times from ${files.length} photos... `);
  const photos = [];
  for (const fileName of files) {
    const { exif } = await sharp(path.join(dir, fileName)).metadata();
    photos.push({ fileName, time: captureTime(exif) });
  }
  const { ordered, backwards } = orderPhotos(photos, values.reverse ? true : null);
  console.log("done.");

  const undated = ordered.filter((e) => e.time === null);

  if (undated.length === photos.length) {
    // Nothing to sort by but the filenames — say so plainly rather than
    // listing every file as a warning.
    console.log(
      `No EXIF capture times (this export stripped them), so order comes from the filenames, ` +
        `${backwards ? "reversed" : "as-is"}.` +
        (values.reverse ? "" : "\nIf that reads backwards on the site, re-run with --reverse.")
    );
  } else {
    if (backwards) {
      console.log(
        values.reverse
          ? "Reversing filename order (--reverse)."
          : "Filenames run backwards against capture time — reordering to match the game."
      );
    }
    if (undated.length > 0) {
      console.warn(
        `Warning: ${undated.length} photo(s) have no EXIF capture time and were placed last:\n` +
          undated.map((e) => `  ${e.fileName}`).join("\n")
      );
    }
  }

  if (values["dry-run"]) {
    console.log(`\nOrder that would be uploaded to ${prefix}:\n`);
    for (const [i, entry] of ordered.entries()) {
      const when = entry.time === null ? "no EXIF time" : new Date(entry.time).toISOString().slice(0, 23).replace("T", " ");
      console.log(`  ${storedName(entry, i)}  (${when})`);
    }
    console.log(`\nDry run — nothing was uploaded.`);
    return;
  }

  console.log(`\nUploading ${files.length} photos to ${prefix}\n`);

  let done = 0;
  for (const [i, entry] of ordered.entries()) {
    const { fileName } = entry;
    const uploadName = storedName(entry, i);
    const filePath = path.join(dir, fileName);
    const buffer = await readFile(filePath);

    // Re-encode the original through sharp too, not just the thumbnail.
    // .rotate() bakes in the EXIF orientation tag before it's discarded,
    // and sharp strips all other metadata (including GPS) by default
    // unless .withMetadata() is called, so this is also how photos of
    // minors taken in public get their location data removed.
    const originalBuffer = await sharp(buffer)
      .rotate()
      .jpeg(JPEG_ORIGINAL)
      .toBuffer();

    const viewBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: VIEW_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    const thumbBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: `${prefix}${uploadName}`,
        Body: originalBuffer,
        ContentType: "image/jpeg",
        // Matches the key (and so the zip entry name), so a photo downloaded
        // on its own and the same photo pulled out of the bulk zip agree.
        ContentDisposition: `attachment; filename="${uploadName}"`,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: `${prefix}view/${uploadName}`,
        Body: viewBuffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: `${prefix}thumbs/${uploadName}`,
        Body: thumbBuffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    done += 1;
    console.log(`  [${done}/${files.length}] ${uploadName}`);
  }

  if (values.caption) {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: `${weekRootPrefix}caption.txt`,
        Body: values.caption,
        ContentType: "text/plain; charset=utf-8",
        CacheControl: "public, max-age=300",
      })
    );
    console.log(`Caption set: "${values.caption}"`);
  }

  console.log(`\nDone. ${prefix} now has ${files.length} photos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
