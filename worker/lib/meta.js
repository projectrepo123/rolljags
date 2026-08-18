const SITE_NAME = "Jaguar Football";
const FALLBACK_DESCRIPTION = "Season photos for Jaguar Football. Browse by week and download full-resolution photos.";

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function buildMeta(title, description, image, pageUrl) {
  return `
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:image" content="${escapeAttr(image)}">
    <meta property="og:url" content="${escapeAttr(pageUrl)}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
  `;
}

// Rewrites the <head> of the week.html asset response with OG/Twitter tags
// reflecting the actual week (real photos, coming-soon, or a generic
// fallback), so links shared in group chats show a real preview instead of
// a blank one. `data` is the result of getWeekData(), or null when the
// query params are missing or don't resolve to a known week.
export function injectWeekMeta(assetResponse, data, url) {
  const fallbackImage = `${url.origin}/logo.webp`;
  const pageUrl = url.toString();

  let title = SITE_NAME;
  let description = FALLBACK_DESCRIPTION;
  let image = fallbackImage;

  if (data && data.status === "live") {
    title = `${data.label} | ${SITE_NAME}`;
    description = data.caption || `${data.label} photos from ${SITE_NAME}. Browse and download the full set.`;
    image = data.cover || fallbackImage;
  } else if (data && data.status === "coming-soon") {
    title = `${data.label} | ${SITE_NAME}`;
    description = "Photos haven't been posted yet. Check back after the game.";
  }

  const metaHtml = buildMeta(title, description, image, pageUrl);

  return new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(title);
      },
    })
    .on("head", {
      element(el) {
        el.append(metaHtml, { html: true });
      },
    })
    .transform(assetResponse);
}
