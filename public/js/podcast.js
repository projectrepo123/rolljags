// Swaps the poster for the real YouTube embed on click. The iframe is kept out
// of the initial page load entirely — it's the heaviest thing on this page, and
// at rest it only showed a thumbnail with two titles fighting over it.
(function initVideoPoster() {
  const poster = document.getElementById("youtube-poster");
  if (!poster) return;

  poster.addEventListener("click", () => {
    const iframe = document.createElement("iframe");
    // autoplay is already on the URL: the click is the user gesture browsers
    // require, so the video starts rather than making them press play twice.
    iframe.src = poster.dataset.embed;
    iframe.title = "Jaguar Football Booster Club YouTube uploads";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;

    poster.replaceWith(iframe);
  }, { once: true });
})();
