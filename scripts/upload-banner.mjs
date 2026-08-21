#!/usr/bin/env node
// Uploads a folder of decorative photos (e.g. old-season shots) to R2 for the
// schedule page's rotating banner. These aren't tied to a year/week/level like
// upload-week.mjs's photos — just a flat set the banner cycles through.
//
//   node upload-banner.mjs --dir ~/Pictures/old-season-photos

import { parseArgs } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const BANNER_PREFIX = "site/schedule-banner/";
// The banner displays these small and cropped, so there's no reason to ship
// full camera-resolution files the way upload-week.mjs's downloadable
// originals do.
const BANNER_WIDTH = 1400;
const IMAGE_EXT = /\.(jpe?g)$/i;

const { values } = parseArgs({ options: { dir: { type: "string" } } });

if (!values.dir) {
  console.error("Missing required --dir");
  process.exit(1);
}

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
  const entries = await readdir(values.dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && IMAGE_EXT.test(e.name))
    .map((e) => e.name)
    .sort();

  if (files.length === 0) {
    console.error(`No .jpg/.jpeg files found in ${values.dir}`);
    process.exit(1);
  }

  console.log(`Uploading ${files.length} banner photos to ${BANNER_PREFIX}\n`);

  let done = 0;
  for (const fileName of files) {
    const filePath = path.join(values.dir, fileName);
    const buffer = await readFile(filePath);

    // .rotate() bakes in EXIF orientation before sharp strips all metadata
    // (including GPS) on re-encode, same as upload-week.mjs.
    const bannerBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: BANNER_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: `${BANNER_PREFIX}${fileName}`,
        Body: bannerBuffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    done += 1;
    console.log(`  [${done}/${files.length}] ${fileName}`);
  }

  console.log(`\nDone. ${BANNER_PREFIX} now has ${files.length} photos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
