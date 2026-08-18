#!/usr/bin/env node
// Uploads one team level's photos for one week to R2, generating a thumbnail
// for each. Run once per level per week — see README.md for usage.
//
//   node upload-week.mjs --year 2026 --week 3 --date 2026-09-11 \
//     --level varsity --dir ~/Photos/wk3-varsity

import { parseArgs } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const VALID_LEVELS = ["varsity", "jv", "freshman"];
const THUMB_WIDTH = 640;
const IMAGE_EXT = /\.(jpe?g)$/i;

const { values } = parseArgs({
  options: {
    year: { type: "string" },
    week: { type: "string" },
    date: { type: "string" },
    level: { type: "string" },
    dir: { type: "string" },
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
if (!VALID_LEVELS.includes(level)) {
  console.error(`--level must be one of: ${VALID_LEVELS.join(", ")}`);
  process.exit(1);
}

const weekNum = String(parseInt(week, 10)).padStart(2, "0");
const weekFolder = `week-${weekNum}_${date}`;
const prefix = `${year}/${weekFolder}/${level}/`;

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
    const thumbBuffer = await sharp(buffer)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: `${prefix}${fileName}`,
        Body: buffer,
        ContentType: "image/jpeg",
        ContentDisposition: `attachment; filename="${fileName}"`,
      })
    );

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: `${prefix}thumbs/${fileName}`,
        Body: thumbBuffer,
        ContentType: "image/jpeg",
      })
    );

    done += 1;
    console.log(`  [${done}/${files.length}] ${fileName}`);
  }

  console.log(`\nDone. ${prefix} now has ${files.length} photos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
