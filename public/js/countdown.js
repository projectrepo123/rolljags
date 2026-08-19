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

  function label(msRemaining) {
    const totalMinutes = Math.floor(msRemaining / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function update() {
    const remaining = kickoff.getTime() - Date.now();

    if (remaining <= 0) {
      if (Date.now() - kickoff.getTime() < GAME_LENGTH_MS) {
        el.textContent = "🏈 Game time";
        el.title = opponent;
        return;
      }
      // Game is over; the next page load picks up the following week.
      el.hidden = true;
      if (timer) clearInterval(timer);
      return;
    }

    el.textContent = `🏈 ${label(remaining)}`;
    el.title = opponent ? `Kickoff ${opponent}` : "Next kickoff";
  }

  update();
  el.hidden = false;
  // Only minute-level precision is shown, so a per-minute tick is plenty.
  timer = setInterval(update, 60000);
})();
