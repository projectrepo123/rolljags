const weeksEl = document.getElementById("weeks");

function weekUrl(year, week) {
  return `/week.html?year=${encodeURIComponent(year)}&week=${encodeURIComponent(week)}`;
}

function renderYear(yearGroup) {
  const section = document.createElement("section");
  section.className = "year-section";

  const heading = document.createElement("h2");
  heading.textContent = `${yearGroup.year} Season`;
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "week-grid";

  // Only show the first week
  for (let i = 0; i < Math.min(1, yearGroup.weeks.length); i++) {
    const week = yearGroup.weeks[i];
    const card = document.createElement("a");
    card.className = "week-card";
    card.href = weekUrl(week.year, week.week);

    if (week.cover) {
      const img = document.createElement("img");
      img.className = "cover";
      img.loading = "lazy";
      img.alt = week.label;
      img.src = week.cover;
      card.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "cover";
      card.appendChild(placeholder);
    }

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("p");
    title.className = "card-title";
    title.textContent = week.label;
    body.appendChild(title);

    if (week.opponent) {
      const opponent = document.createElement("p");
      opponent.className = "card-opponent";
      opponent.style.fontSize = "0.9rem";
      opponent.style.color = "var(--text-muted)";
      opponent.style.margin = "0.25rem 0 0.5rem 0";
      opponent.textContent = `${week.homeAway === "Home" ? "H" : "A"} vs. ${week.opponent}`;
      body.appendChild(opponent);
    }

    if (week.status === "coming-soon") {
      const badge = document.createElement("span");
      badge.className = "badge-coming-soon";
      badge.textContent = "Coming soon";
      body.appendChild(badge);
    } else {
      const count = document.createElement("p");
      count.className = "card-count";
      count.textContent = `${week.photoCount} photo${week.photoCount === 1 ? "" : "s"}`;
      body.appendChild(count);
    }

    card.appendChild(body);
    grid.appendChild(card);
  }

  /* TODO: Show other weeks
  for (let i = 1; i < yearGroup.weeks.length; i++) {
    const week = yearGroup.weeks[i];
    // Week card for: ${week.label}
  }
  */

  section.appendChild(grid);
  return section;
}

async function init() {
  try {
    const res = await fetch("/api/weeks");
    const data = await res.json();

    weeksEl.innerHTML = "";

    if (!data.years || data.years.length === 0) {
      weeksEl.innerHTML = '<p class="empty-state">No photos yet. Check back after the next game.</p>';
      return;
    }

    for (const yearGroup of data.years) {
      weeksEl.appendChild(renderYear(yearGroup));
    }
  } catch (err) {
    weeksEl.innerHTML = '<p class="empty-state">Couldn\'t load photos right now. Try refreshing.</p>';
  }
}

init();
