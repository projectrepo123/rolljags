#!/usr/bin/env node
// One-off: writes a small WebP tile for every archive-strip photo in R2, at
// site/schedule-banner/thumbs/<name>.webp. The strip shows them at about
// 150x200 CSS px, so the 1400px originals (4.7 MB for the set) are a waste
// on every home visit. The originals stay put for the viewer.
//
//   node make-banner-thumbs.mjs [--dry-run]
//
// Safe to re-run: it overwrites the same keys with the same bytes.

import { parseArgs } from "node:util";
import "dotenv/config";
import sharp from "sharp";
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const PREFIX = "site/schedule-banner/";
const IMAGE_EXT = /\.(jpe?g)$/i;
// 2x the largest tile (150x200), cover-cropped to the tile's 3:4 shape.
const TILE = { width: 300, height: 400 };

const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
const Bucket = process.env.R2_BUCKET;

const listed = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: PREFIX, Delimiter: "/" }));
const keys = (listed.Contents || []).map((o) => o.Key).filter((k) => IMAGE_EXT.test(k));
console.log(`${keys.length} photos under ${PREFIX}`);

let before = 0;
let after = 0;
for (const key of keys) {
  const got = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  const source = Buffer.from(await got.Body.transformToByteArray());
  const tile = await sharp(source).rotate().resize({ ...TILE, fit: "cover" }).webp({ quality: 72 }).toBuffer();
  before += source.length;
  after += tile.length;
  const name = key.slice(PREFIX.length).replace(IMAGE_EXT, ".webp");
  console.log(`  ${name}  ${Math.round(source.length / 1024)}KB -> ${Math.round(tile.length / 1024)}KB`);
  if (values["dry-run"]) continue;
  await s3.send(
    new PutObjectCommand({
      Bucket,
      Key: `${PREFIX}thumbs/${name}`,
      Body: tile,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}
console.log(`\n${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB${values["dry-run"] ? " (dry run, nothing written)" : ""}`);
