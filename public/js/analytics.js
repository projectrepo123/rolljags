// Google Analytics 4 bootstrap. Lives in its own file rather than the usual
// inline snippet because the CSP (worker/index.js) doesn't allow inline
// scripts. The worker adds this and the gtag.js loader to every HTML page.
window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}
gtag("js", new Date());
gtag("config", "G-FS8FK1Z6C1");
