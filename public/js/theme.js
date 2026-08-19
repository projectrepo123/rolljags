function initTheme() {
  const html = document.documentElement;
  const toggle = document.getElementById("theme-toggle");

  function setTheme(theme) {
    if (theme === "dark") {
      html.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
      if (toggle) toggle.textContent = "☀️";
    } else {
      html.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
      if (toggle) toggle.textContent = "🌙";
    }
  }

  function updateTheme() {
    const current = html.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
  }

  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    setTheme("dark");
  } else if (saved === "light") {
    setTheme("light");
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }

  if (toggle) {
    toggle.addEventListener("click", updateTheme);
  }
}

initTheme();
