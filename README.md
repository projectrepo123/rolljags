# Jaguar Football Photos | rolljags.com

Static site + Cloudflare Worker + R2 for sharing season photos. No accounts,
no build step, no admin UI. Weeks are uploaded from the command line and the
site reads directly from R2.

## How it's organized

Photos live in R2 under:

```
{year}/week-{NN}_{yyyy-mm-dd}/{level}/IMG_0001.jpg
{year}/week-{NN}_{yyyy-mm-dd}/{level}/thumbs/IMG_0001.jpg
{year}/week-{NN}_{yyyy-mm-dd}/caption.txt   (optional)
```

`level` is `varsity`, `jv`, or `freshman`. There's no separate config file for
weeks that already have photos. The site parses everything it needs (year,
week number, date, team level, photo count) straight from the folder names,
so uploading a new week's photos with the right folder name is the entire
"publishing" step.

### Showing a week before photos exist ("Coming soon")

To have a week appear on the site (as "Coming soon") before you've uploaded
anything, e.g. the day of a game, before you've had a chance to upload,
add its week number to `worker/lib/schedule.js`:

```js
export const SCHEDULE = {
  "2026": ["01", "02"],
};
```

Once you run `upload-week.mjs` for that week, real data (date, photo count,
cover thumbnail) automatically takes over and the "Coming soon" badge goes
away. No need to remove the entry from the schedule. To start a new season,
add a new year key the same way.

### Per-week caption

To show an optional one-line caption near the top of a week's page (e.g. the
opponent and final score), either pass `--caption "..."` when uploading (see
below), or add/edit a plain text object called `caption.txt` at the week's
folder root directly in the R2 dashboard's object browser at any time. No
redeploy needed either way. Leave it unset and nothing renders.

## One-time setup

**Prerequisite:** Node.js 22+ (required by Wrangler). Check with `node --version`; if you're on an older version, install a current one from nodejs.org or with a version manager like `nvm`/`volta`.

### 1. Cloudflare R2 bucket

```
wrangler login
wrangler r2 bucket create rolljags-photos
```

### 2. Public access for photos

In the Cloudflare dashboard: **R2 → rolljags-photos → Settings → Public
Access → Enable**, then **Custom Domains → Add** and enter
`photos.rolljags.com`, then **Connect Domain**. This requires `rolljags.com`
to already be on Cloudflare (it will be, since the site itself is deployed
there too). Wait for the domain status to go from Initializing to Active.

This is a **separate subdomain** from the site itself (`rolljags.com`).
Photos are served directly from R2/Cloudflare's CDN with no Worker involved,
which keeps downloads fast and free of egress cost.

### 3. API token for the upload script

In the dashboard: **R2 → Manage API Tokens → Create API Token**, scope it to
**Object Read & Write** on just the `rolljags-photos` bucket, and copy the
Access Key ID and Secret Access Key (shown once).

```
cd scripts
cp .env.example .env
# fill in R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
npm install
```

`R2_ACCOUNT_ID` is your Cloudflare account ID, shown in the dashboard URL or
sidebar. This token is only used by the upload script, it's unrelated to
`wrangler login`.

### 4. Deploy the site

```
npm install
npx wrangler deploy
```

`wrangler.jsonc` already points the Worker at `rolljags.com` and binds the
R2 bucket, so this provisions DNS/TLS and ships the site + API in one step.

Note: bulk zip downloads need **Workers Paid** ($5/mo flat). The free plan
caps requests at 50 subrequests, and reading 100+ photos out of R2 for one
zip exceeds that. Everything else (storage, photo views, single-photo
downloads) comfortably fits in free-tier limits.

### 5. Web Analytics (optional)

In the Cloudflare dashboard: **Analytics & Logs → Web Analytics → Add a
site**, and select `rolljags.com`. This uses automatic setup, so Cloudflare
injects the tracking beacon at the edge with no code changes here. It's
cookie-free, so no cookie banner is needed.

### 6. Rate limiting rule (recommended)

The zip endpoint already has an in-Worker rate limit (`wrangler.jsonc`'s
`ratelimits` binding, 6 zip downloads per IP per minute), but every
Cloudflare plan, including Free, also includes **one free WAF rate limiting
rule**. Using it here adds a second layer that blocks abusive requests at
the edge, before they even reach the Worker or R2: **Security → WAF → Rate
limiting rules → Create rule**, match requests where the URL path starts
with `/api/zip/`, and set a similar threshold (e.g. block after 10 requests
in 1 minute per IP).

### 7. Billing and usage alerts (recommended)

Since this site is public and unauthenticated, set up alerts so you're
warned before a cost spike rather than after: **Manage Account →
Notifications → Add**, and add usage-based alerts for R2 storage/operations
and for Workers requests.

### 8. Confirm HTTPS is enforced

Under **SSL/TLS → Edge Certificates**, confirm **Always Use HTTPS** is
enabled for the zone. The Worker also sends a `Strict-Transport-Security`
header as a backstop, but this dashboard setting is what actually redirects
stray HTTP requests.

## Uploading a new week

Run once per team level that has photos that week (skip levels with nothing
to upload, their tab just won't appear on the site):

```
cd scripts
node upload-week.mjs --year 2026 --week 3 --date 2026-09-11 \
  --level varsity --dir ~/Photos/wk3-varsity --caption "vs. Fox, W 28-14"

node upload-week.mjs --year 2026 --week 3 --date 2026-09-11 \
  --level jv --dir ~/Photos/wk3-jv
```

- `--week` is just the number (`3`, not `03`, the script pads it).
- `--date` is the game date, `YYYY-MM-DD`.
- `--dir` is a local folder of `.jpg`/`.jpeg` files (already-exported JPEGs,
  the script doesn't convert HEIC).
- `--caption` is optional and only needs to be passed once per week (it's
  stored at the week level, not per team level).
- The script generates a thumbnail for each photo and uploads both the
  original (tagged for direct download) and the thumbnail to R2. Both are
  re-encoded through `sharp` on the way up, which strips all EXIF metadata,
  including GPS location, from the originals automatically.

That's it, no redeploy needed. The site lists whatever's in R2, live, with
a short cache (~5 minutes) on the home page listing.

## Local development

```
npm install
npx wrangler dev
```

Serves the static site and `/api/*` routes together at `localhost:8787`,
using a local simulated R2 bucket (separate from production data). Seed it
with a test week using:

```
npx wrangler r2 object put rolljags-photos/2026/week-01_2026-09-06/varsity/IMG_0001.jpg \
  --file ./some-photo.jpg --local --content-type image/jpeg
```

(add a matching file under `.../varsity/thumbs/` too). Pass `--remote` to
`wrangler dev` instead if you want to develop against the real bucket.

## Notes

- The "Download all (.zip)" response streams directly from R2 rather than being built in memory, so it scales to 100+ photos without issue. Because it's streamed, browsers won't show a file size or an accurate progress bar during download (the file itself is complete and valid, this is just a missing size hint).
- Week pages (`/week.html?year=&week=`) get their Open Graph preview tags (title, description, image) injected server-side by the Worker based on that week's real data, so links shared in group chats show the week's cover photo. The homepage and 404 page use static tags with the site logo.
- `public/404.html` is served automatically for any unmatched path, configured via `not_found_handling` in `wrangler.jsonc`.
- The Worker validates `year`/`week`/`level` before touching R2 (rejects malformed requests with 400), rate-limits the zip endpoint per IP (429 once tripped), and sets security headers (CSP, HSTS, etc.) on every response. `/api/week/:year/:week` and `/week.html` share the same 5-minute cache as `/api/weeks`, so repeat visits to the same week don't re-list R2 each time.

## Project layout

```
public/            Static site (no build step)
worker/            Worker: serves public/ and handles /api/*
scripts/           Local upload script (run from your own machine)
wrangler.jsonc     Worker + R2 binding + custom domain config
```
