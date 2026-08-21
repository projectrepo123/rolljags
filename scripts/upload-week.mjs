#!/usr/bin/env node
// Uploads one named group of photos for one week to R2, generating a
// thumbnail for each and stripping EXIF/GPS metadata from the originals. Run
// once per group per week, see README.md for usage.
//
//   node upload-week.mjs --year 2026 --week 3 --date 2026-09-11 \
//     --level varsity --dir ~/Photos/wk3-varsity --caption "vs. Fox, W 28-14"
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

const { values } = parseArgs({
  options: {
    year: { type: "string" },
    week: { type: "string" },
    date: { type: "string" },
    level: { type: "string" },
    dir: { type: "string" },
    caption: { type: "string" },
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

const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in scripts/.env — copy .env.example and fill it in.`);
    process.exit(1);
  }
}

const s3 = new S3Client({
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

  console.log(`Uploading ${files.length} photos to ${prefix}\n`);

  let done = 0;
  for (const fileName of files) {
    const filePath = path.join(dir, fileName);
    const buffer = await readFile(filePath);

    // Re-encode the original through sharp too, not just the thumbnail.
    // .rotate() bakes in the EXIF orientation tag before it's discarded,
    // and sharp strips all other metadata (including GPS) by default
    // unless .withMetadata() is called, so this is also how photos of
    // minors taken in public get their location data removed.
    const originalBuffer = await sharp(buffer)
      .rotate()
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
      .toBuffer();

    const viewBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: VIEW_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    const thumbBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: `${prefix}${fileName}`,
        Body: originalBuffer,
        ContentType: "image/jpeg",
        ContentDisposition: `attachment; filename="${fileName}"`,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: `${prefix}view/${fileName}`,
        Body: viewBuffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: `${prefix}thumbs/${fileName}`,
        Body: thumbBuffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    done += 1;
    console.log(`  [${done}/${files.length}] ${fileName}`);
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
