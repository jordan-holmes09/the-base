/* One-line embed for a Go High-Level (or any) page:
   <script src="https://<static-host>/embed.js" defer></script>
   Loads The Base into the page from the static host and adds the iOS Add-to-Home-Screen tags. */
(() => {
  const src = document.currentScript && document.currentScript.src;
  const base = src ? src.replace(/\/embed\.js(\?.*)?$/, "") : "";
  window.THE_BASE_BASE_URL = base;
  const head = document.head;
  const add = (tag, attrs) => { const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); head.appendChild(el); return el; };
  const metas = [["apple-mobile-web-app-capable", "yes"], ["mobile-web-app-capable", "yes"], ["apple-mobile-web-app-status-bar-style", "black-translucent"], ["apple-mobile-web-app-title", "The Base"], ["theme-color", "#0C1712"], ["robots", "noindex, nofollow"]];
  for (const [name, content] of metas) if (!head.querySelector(`meta[name="${name}"]`)) add("meta", { name, content });
  if (!head.querySelector('meta[name="viewport"]')) add("meta", { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" });
  add("link", { rel: "apple-touch-icon", href: `${base}/icons/apple-touch-icon.png` });
  add("link", { rel: "manifest", href: `${base}/manifest.webmanifest`, crossorigin: "anonymous" });
  add("link", { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600&display=swap" });
  add("link", { rel: "stylesheet", href: `${base}/styles.css` });
  document.documentElement.style.background = "#0C1712";
  const mount = () => {
    let app = document.getElementById("app");
    if (!app) { app = document.createElement("div"); app.id = "app"; app.className = "app"; document.body.appendChild(app); }
    document.body.style.margin = "0"; document.body.style.background = "#0C1712";
    const s = document.createElement("script"); s.src = `${base}/app.js`; s.defer = true; document.body.appendChild(s);
  };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
