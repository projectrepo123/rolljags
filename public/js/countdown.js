// Renders a live countdown to the next kickoff in the nav bar. The kickoff
// instant is stamped into the page head by the worker (see injectKickoff),
// so this runs on every page without fetching the schedule.
(function initCountdown() {
  const el = document.getElementById("kickoff-countdown");
  const labelEl = document.getElementById("kickoff-label");
  const clockEl = document.getElementById("kickoff-clock");
  if (!el || !labelEl || !clockEl) return;

  const kickoffMeta = document.querySelector('meta[name="next-kickoff"]');
  if (!kickoffMeta) return; // No games left on the schedule.

  const kickoff = new Date(kickoffMeta.content);
  if (Number.isNaN(kickoff.getTime())) return;

  const opponent = document.querySelector('meta[name="next-opponent"]')?.content || "";

  // Games run roughly two and a half hours; treat that window as "in progress"
  // rather than immediately flipping to the next week's game.
  const GAME_LENGTH_MS = 2.5 * 60 * 60 * 1000;
  let timer = null;

  const pad = (n) => String(n).padStart(2, "0");

  // On a phone the bar has to fit the wordmark, this pill and the hamburger in
  // about 360px. The full form runs to "12d 20:14:33" and takes roughly 100px,
  // which is what used to push the brand name out over the pill — and it also
  // changed width by ~30px across the week as the day segment came and went.
  // Read live rather than cached: update() runs every second anyway, so a
  // rotation into landscape picks up the wider form on the next tick.
  const narrow = window.matchMedia("(max-width: 480px)");

  // Digital-clock style: "9d 20:14:33", dropping the day segment once
  // there's less than a day to go. On a phone the seconds only appear once
  // they're worth watching, so the pill stays about 55px wide all week.
  function clockFace(msRemaining) {
    const totalSeconds = Math.floor(msRemaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (narrow.matches) {
      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
      return `${minutes}:${pad(seconds)}`;
    }

    const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return days > 0 ? `${days}d ${clock}` : clock;
  }

  function update() {
    const remaining = kickoff.getTime() - Date.now();

    if (remaining <= 0) {
      if (Date.now() - kickoff.getTime() < GAME_LENGTH_MS) {
        el.classList.add("is-live");
        labelEl.textContent = "Live";
        clockEl.textContent = "Game on";
        el.title = opponent;
        return;
      }
      // Game is over; the next page load picks up the following week.
      el.hidden = true;
      if (timer) clearInterval(timer);
      return;
    }

    labelEl.textContent = "Kickoff in";
    clockEl.textContent = clockFace(remaining);
    el.title = opponent ? `Kickoff ${opponent}` : "Next kickoff";
  }

  update();
  el.hidden = false;
  timer = setInterval(update, 1000);
})();
