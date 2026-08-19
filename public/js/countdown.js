// Renders a live countdown to the next kickoff in the nav bar. The kickoff
// instant is stamped into the page head by the worker (see injectKickoff),
// so this runs on every page without fetching the schedule.
(function initCountdown() {
  const el = document.getElementById("kickoff-countdown");
  if (!el) return;

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

  // Digital-clock style: "9d 20:14:33", dropping the day segment once
  // there's less than a day to go.
  function clockFace(msRemaining) {
    const totalSeconds = Math.floor(msRemaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return days > 0 ? `${days}d ${clock}` : clock;
  }

  function update() {
    const remaining = kickoff.getTime() - Date.now();

    if (remaining <= 0) {
      if (Date.now() - kickoff.getTime() < GAME_LENGTH_MS) {
        el.textContent = "Game time";
        el.title = opponent;
        return;
      }
      // Game is over; the next page load picks up the following week.
      el.hidden = true;
      if (timer) clearInterval(timer);
      return;
    }

    el.textContent = clockFace(remaining);
    el.title = opponent ? `Kickoff ${opponent}` : "Next kickoff";
  }

  update();
  el.hidden = false;
  timer = setInterval(update, 1000);
})();
