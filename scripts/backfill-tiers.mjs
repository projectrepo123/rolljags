#!/usr/bin/env node
// Builds the WebP sizes (see WEBP_TIERS in upload-week.mjs) for photos that
// were uploaded before they existed, from each photo's existing 1600w view/
// copy, so the multi-megabyte originals are never touched.
//
//   node backfill-tiers.mjs --year 2026 [--week 05] [--dry-run]
//
// Safe to re-run: photos that already have all three files are skipped.

import { parseArgs } from "node:util";
import "dotenv/config";
import sharp from "sharp";
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const IMAGE_EXT = /\.(jpe?g)$/i;
const TIERS = [
  { dir: "thumbs", width: 400, quality: 75, suffix: ".400.webp" },
  { dir: "thumbs", width: 640, quality: 75, suffix: ".640.webp" },
  { dir: "view", width: 1080, quality: 78, suffix: ".1080.webp" },
];

const { values } = parseArgs({
  options: { year: { type: "string" }, week: { type: "string" }, "dry-run": { type: "boolean", default: false } },
});
if (!values.year) {
  console.error("Missing required --year");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
const Bucket = process.env.R2_BUCKET;

async function list(Prefix, delimiter = true) {
  const keys = [];
  const prefixes = [];
  let ContinuationToken;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket, Prefix, ...(delimiter ? { Delimiter: "/" } : {}), ContinuationToken }));
    for (const o of r.Contents || []) keys.push(o.Key);
    for (const p of r.CommonPrefixes || []) prefixes.push(p.Prefix);
    ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return { keys, prefixes };
}

let made = 0;
let skipped = 0;
const weeks = (await list(`${values.year}/`)).prefixes.filter((p) => !values.week || p.includes(`week-${values.week.padStart(2, "0")}_`));

for (const weekPrefix of weeks) {
  for (const levelPrefix of (await list(weekPrefix)).prefixes) {
    const originals = (await list(levelPrefix)).keys.filter((k) => IMAGE_EXT.test(k));
    if (originals.length === 0) continue;
    const have = new Set((await list(`${levelPrefix}thumbs/`)).keys);
    console.log(`${levelPrefix}  ${originals.length} photos`);

    // A few photos at a time: each is one download and three uploads, and
    // doing them one by one takes hours for a season.
    const queue = [...originals];
    const worker = async () => {
      for (let key = queue.shift(); key; key = queue.shift()) {
        const stem = key.split("/").pop().replace(IMAGE_EXT, "");
        if (have.has(`${levelPrefix}thumbs/${stem}.400.webp`)) {
          skipped++;
          continue;
        }
        if (values["dry-run"]) {
          made++;
          continue;
        }
        const got = await s3.send(new GetObjectCommand({ Bucket, Key: `${levelPrefix}view/${key.split("/").pop()}` }));
        const source = Buffer.from(await got.Body.transformToByteArray());
        await Promise.all(
          TIERS.map(async (tier) => {
            const body = await sharp(source).resize({ width: tier.width, withoutEnlargement: true }).webp({ quality: tier.quality }).toBuffer();
            await s3.send(
              new PutObjectCommand({
                Bucket,
                Key: `${levelPrefix}${tier.dir}/${stem}${tier.suffix}`,
                Body: body,
                ContentType: "image/webp",
                CacheControl: "public, max-age=31536000, immutable",
              })
            );
          })
        );
        made++;
        if (made % 50 === 0) console.log(`  ...${made} done`);
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
  }
}
console.log(`\n${values["dry-run"] ? "Would build" : "Built"} ${made} photos, skipped ${skipped} that already had them.`);
