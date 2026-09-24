/* The Base — static, passcode-protected team knowledge base for The Hideaways.
   No server. Facts ship as an AES-GCM bundle (data/facts.enc) decrypted in the browser with the team passcode. */
(() => {
  "use strict";
  const BASE = (window.THE_BASE_BASE_URL || "").replace(/\/$/, "");
  const asset = (p) => (BASE ? `${BASE}/${p}` : p);
  const FLAG_TO = "jordan@thehideaways.co";
  const LS = { key: "thebase.key", view: "thebase.view", cabin: "thebase.cabin", a2hs: "thebase.a2hs.dismissed", mic: "thebase.mic.hinted" };
  const $app = document.getElementById("app");
  const state = { data: null, view: localStorage.getItem(LS.view) || "team", cabin: localStorage.getItem(LS.cabin) || "all", q: "", autoQ: null, listening: false };
  const setCabin = (slug, manual) => { state.cabin = slug; localStorage.setItem(LS.cabin, slug); if (manual) state.autoQ = state.q; };

  // ---------------- crypto ----------------
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const b64e = (u) => btoa(String.fromCharCode(...new Uint8Array(u)));
  async function fetchBundle() {
    const r = await fetch(asset("data/facts.enc"), { cache: "no-store" });
    if (!r.ok) throw new Error(`bundle ${r.status}`);
    return r.json();
  }
  async function keyFromPass(pass, bundle) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64d(bundle.salt), iterations: bundle.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
  }
  async function decrypt(bundle, key) {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(bundle.iv) }, key, b64d(bundle.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }
  async function tryStoredKey(bundle) {
    const raw = localStorage.getItem(LS.key);
    if (!raw) return null;
    try {
      const key = await crypto.subtle.importKey("raw", b64d(raw), { name: "AES-GCM" }, true, ["decrypt"]);
      return await decrypt(bundle, key);
    } catch { localStorage.removeItem(LS.key); return null; }
  }

  // ---------------- search ----------------
  const STOP = new Set("the a an is are do does did have has had what whats where wheres when how which who it its in on at to for of and or with can could i we you our your me my this that any about tell show give please cabin there they their be was were will would should".split(" "));
  const SYN = {
    wifi: ["wi-fi", "internet", "network", "wireless", "ssid"], internet: ["wifi", "wi-fi", "network"], password: ["wifi", "network"],
    hottub: ["hot tub", "spa", "jacuzzi"], jacuzzi: ["hot tub"], spa: ["hot tub"],
    checkout: ["check-out", "check out", "departure", "leave"], checkin: ["check-in", "check in", "arrival", "arrive"],
    tv: ["roku", "television", "streaming", "netflix"], roku: ["tv", "streaming"], netflix: ["tv", "roku", "streaming"],
    trash: ["garbage", "waste", "recycling", "bags"], garbage: ["trash", "waste"],
    fridge: ["refrigerator"], refrigerator: ["fridge"],
    dog: ["dogs", "pet", "pets"], dogs: ["pet", "pets", "dog"], pet: ["pets", "dog", "dogs"], pets: ["pet", "dog", "dogs"],
    car: ["vehicle", "4x4", "awd", "drive", "truck"], vehicle: ["4x4", "awd", "car"], truck: ["vehicle", "4x4"],
    directions: ["address", "map", "pin", "gps", "route", "road"], address: ["directions", "map", "pin"], map: ["pin", "directions", "gps"],
    coffee: ["keurig", "k-cup", "k-cups", "espresso", "drip"], keurig: ["coffee", "k-cup"],
    firewood: ["wood", "fire pit", "firepit", "fire"], firepit: ["fire pit", "firewood", "fire"], fire: ["fire pit", "firewood", "fireplace"],
    grill: ["bbq", "barbecue", "propane", "grilling"], bbq: ["grill", "propane"],
    heat: ["heating", "thermostat", "ac", "hvac", "mini split", "temperature"], ac: ["air conditioning", "cooling", "mini split", "thermostat"], thermostat: ["ac", "heat", "temperature"],
    kids: ["children", "child", "infant", "family", "age"], children: ["kids", "child", "age"], baby: ["infant", "children", "kids"],
    late: ["late check-out", "late checkout"], early: ["early check-in", "early checkin"],
    dishwasher: ["dishes"], dishes: ["dishwasher", "hand wash"],
    oven: ["stove", "cooktop", "range"], stove: ["oven", "cooktop"], cook: ["cooktop", "stove", "oven", "kitchen"],
    towels: ["towel", "linens"], sheets: ["linens", "bedding"], bed: ["beds", "bedroom", "king", "queen", "mattress"],
    cancel: ["cancellation", "refund"], refund: ["cancellation", "cancel", "deposit"], deposit: ["security deposit", "hold"],
    price: ["fee", "cost", "rate"], fee: ["price", "cost", "charge"], cost: ["fee", "price"],
    lock: ["keypad", "door code", "code", "lockbox"], keypad: ["lock", "code"], key: ["keypad", "lock", "lockbox"],
    phone: ["call", "text", "contact", "number"], contact: ["phone", "email", "call"],
    hike: ["hikes", "trail", "trails", "hiking"], hiking: ["hike", "trails"], trail: ["hike", "trails"],
    eat: ["restaurant", "restaurants", "food", "dinner"], food: ["restaurant", "grocery", "eat"], restaurant: ["restaurants", "eat", "dinner"], grocery: ["groceries", "store", "kroger", "save-a-lot"],
    power: ["breaker", "electric", "outage", "electricity"], breaker: ["power", "panel", "electric"],
    sauna: ["barrel sauna", "heater"], telescope: ["stargazing", "stars"], stars: ["stargazing", "telescope", "night sky"],
    signal: ["cell", "service", "reception", "verizon", "att"], cell: ["signal", "service", "reception"],
    smoke: ["smoking", "vape"], smoking: ["smoke"],
    parking: ["park", "driveway", "spots"], park: ["parking", "driveway"],
  };
  const CABIN_WORDS = { onyx: "the-onyx", rockface: "rockface-retreat", still: "the-still", taoist: "the-taoist", blackstone: "the-blackstone" };
  const norm = (s) => s.toLowerCase().replace(/[’']/g, "").replace(/[-–—/]/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = (s) => norm(s).split(" ").filter((t) => t && !STOP.has(t));
  const nostem = (t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t);

  function parseQuery(q) {
    let toks = tokens(q);
    let cabin = null;
    toks = toks.filter((t) => { if (CABIN_WORDS[t]) { cabin = CABIN_WORDS[t]; return false; } return true; });
    // compound normalizations
    const joined = " " + toks.join(" ") + " ";
    const compounds = [["hot tub", "hottub"], ["check in", "checkin"], ["check out", "checkout"], ["fire pit", "firepit"], ["wi fi", "wifi"], ["k cup", "kcup"], ["4 x 4", "4x4"]];
    let j = joined;
    for (const [a, b] of compounds) j = j.split(` ${a} `).join(` ${b} `);
    toks = j.trim().split(" ").filter(Boolean);
    const expanded = new Set(toks.map(nostem));
    for (const t of toks) for (const s of SYN[t] || SYN[nostem(t)] || []) expanded.add(norm(s).replace(/ /g, "")); // synonyms as compact tokens
    for (const t of toks) for (const s of SYN[t] || SYN[nostem(t)] || []) for (const w of norm(s).split(" ")) if (!STOP.has(w) && w.length >= 3) expanded.add(nostem(w));
    return { toks, expanded: [...expanded], cabin, phrase: norm(q) };
  }
  function scoreFact(f, pq) {
    const title = norm(f.title), ans = norm(f.answer), cat = norm(f.category);
    const titleC = title.replace(/ /g, ""), ansC = ans.replace(/ /g, "");
    const lenPen = Math.min(1, Math.sqrt(220 / Math.max(ans.length, 40))); // answers over ~220 chars score less per body hit
    let s = 0, hits = 0;
    for (const t of pq.expanded) {
      if (t.length < 2) continue;
      const rx = new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${t.length <= 3 ? "(\\s|$)" : ""}`); // short tokens must match whole words
      let h = 0;
      if (rx.test(title)) h += 6; else if (titleC.includes(t) && t.length > 3) h += 3;
      if (rx.test(ans)) h += 2.5 * lenPen; else if (ansC.includes(t) && t.length > 4) h += 1 * lenPen;
      if (rx.test(cat)) h += 2;
      if (h) hits++;
      s += h;
    }
    if (!s) return 0;
    if (pq.toks.length > 1) s *= 1 + 0.35 * (hits / pq.expanded.length) * pq.toks.length; // reward covering more of the query
    if (pq.phrase.length > 6 && (title.includes(pq.phrase) || ans.includes(pq.phrase))) s += 8;
    if (f.verified === "verified") s += 0.6;
    if (f.category === "Data quality") s -= 1.5;
    if (f.category === "Marketing") s *= 0.6;
    return s;
  }
  function visibleFacts() {
    const guest = state.view === "guest";
    return state.data.facts.filter((f) => (state.cabin === "all" || f.cabin === state.cabin) && (!guest || (f.audience === "guest" && f.category !== "Data quality")));
  }
  function search(q) {
    const pq = parseQuery(q);
    if (pq.cabin && pq.cabin !== state.cabin && state.autoQ !== q) { setCabin(pq.cabin, false); }
    state.autoQ = q;
    if (!pq.expanded.length) return { pq, results: [] };
    const res = visibleFacts().map((f) => ({ f, s: scoreFact(f, pq) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 15);
    return { pq, results: res.map((x) => x.f) };
  }
  function photosFor(f) {
    const cabin = state.data.cabins.find((c) => c.slug === f.cabin);
    if (!cabin) return [];
    const blob = " " + norm(f.title + " " + f.answer).replace(/ /g, "  ") + " ";
    return cabin.photos.filter((p) => p.tags.some((t) => blob.includes(" " + norm(t).replace(/ /g, "  ") + " ") || (norm(t).length > 5 && blob.replace(/ /g, "").includes(norm(t).replace(/ /g, ""))))).slice(0, 3);
  }

  // ---------------- rendering ----------------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const ICON = {
    mic: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    copy: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    flag: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-1.5 4L16 12H5"/></svg>',
    share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>',
  };
  const VER = { verified: "✓ Verified", unverified: "○ Unverified", conflict: "⚠ Sources conflict" };
  const cabinOf = (slug) => state.data.cabins.find((c) => c.slug === slug);

  function renderLock(err = "", busy = false) {
    $app.innerHTML = `
      <section class="lock">
        <div class="lock-inner">
          <img class="lock-mark" src="${asset("icons/mark-cream.png")}" alt="The Hideaways">
          <div class="eyebrow">The Hideaways · Team</div>
          <h1>The Base</h1>
          <p class="sub">Every cabin. Every answer. <em>Ask away.</em></p>
          <form id="lockform" autocomplete="off">
            <label class="sr-only" for="pass">Team passcode</label>
            <div class="field"><input id="pass" type="password" inputmode="text" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Team passcode" required ${busy ? "disabled" : ""}></div>
            <label class="check"><input type="checkbox" id="remember" checked> Remember this device</label>
            <button class="btn-primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Unlocking…" : "Unlock"}</button>
            <p class="err" role="alert">${esc(err)}</p>
          </form>
          <p class="foot">Passcode lives in 1Password. Ask Jordan, Mike, or Debbie.</p>
        </div>
      </section>`;
    const form = document.getElementById("lockform");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pass = document.getElementById("pass").value.trim();
      const remember = document.getElementById("remember").checked;
      if (!pass) return;
      renderLock("", true);
      try {
        const bundle = await fetchBundle();
        const key = await keyFromPass(pass, bundle);
        const data = await decrypt(bundle, key);
        if (remember) localStorage.setItem(LS.key, b64e(await crypto.subtle.exportKey("raw", key)));
        state.data = data; renderApp();
      } catch (err) {
        renderLock(String(err).includes("bundle") ? "Couldn't load the knowledge base. Check your connection." : "That's not it. Check the passcode in 1Password.");
        setTimeout(() => document.getElementById("pass")?.focus(), 50);
      }
    });
    document.getElementById("pass").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.code === "Enter" || e.keyCode === 13) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true })); } });
    setTimeout(() => document.getElementById("pass")?.focus(), 80);
  }

  function renderApp() {
    const guest = state.view === "guest";
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    const standalone = window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
    const showA2HS = isIOS && !standalone && !localStorage.getItem(LS.a2hs);
    $app.innerHTML = `
      <header class="topbar">
        <div class="topbar-row">
          <div class="brand"><span class="eyebrow">The Hideaways</span><span class="name">The Base</span></div>
          <div class="seg" role="group" aria-label="View">
            <button type="button" data-view="team" aria-pressed="${!guest}">Team</button>
            <button type="button" data-view="guest" aria-pressed="${guest}">Guest-safe</button>
          </div>
        </div>
      </header>
      ${guest ? `<div class="guest-banner"><b>Guest-safe view.</b> Everything shown here can be relayed to a guest.</div>` : ""}
      <main class="shell">
        ${showA2HS ? `<div class="tip" id="a2hs">${ICON.share}<div><b>Add The Base to your Home Screen.</b> Tap Share, then “Add to Home Screen”. It opens like an app, no browser bars.</div><button class="close" aria-label="Dismiss">×</button></div>` : ""}
        <nav class="chips" aria-label="Cabin">
          <button class="chip" data-cabin="all" aria-pressed="${state.cabin === "all"}">All cabins</button>
          ${state.data.cabins.map((c) => `<button class="chip" data-cabin="${c.slug}" aria-pressed="${state.cabin === c.slug}">${esc(c.name)}</button>`).join("")}
        </nav>
        <div class="search">
          <div class="search-box">
            <label class="sr-only" for="q">Ask a question</label>
            <input id="q" type="search" enterkeyhint="search" autocomplete="off" autocorrect="on" placeholder="${esc(placeholder())}" value="${esc(state.q)}">
            <button class="icon-btn" id="clear" aria-label="Clear" style="${state.q ? "" : "display:none"}">${ICON.x}</button>
            <button class="icon-btn" id="mic" aria-label="Dictate" aria-pressed="false">${ICON.mic}</button>
          </div>
        </div>
        <div id="out"></div>
      </main>
      <div class="toast" id="toast" role="status"></div>`;
    $app.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { state.view = b.dataset.view; localStorage.setItem(LS.view, state.view); renderApp(); }));
    $app.querySelectorAll(".chip[data-cabin]").forEach((b) => b.addEventListener("click", () => { setCabin(b.dataset.cabin, true); renderApp(); }));
    document.getElementById("a2hs")?.querySelector(".close").addEventListener("click", () => { localStorage.setItem(LS.a2hs, "1"); document.getElementById("a2hs").remove(); });
    const $q = document.getElementById("q"), $clear = document.getElementById("clear");
    let t;
    $q.addEventListener("input", () => { state.q = $q.value; $clear.style.display = state.q ? "" : "none"; clearTimeout(t); t = setTimeout(renderOut, 90); });
    $q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $q.blur(); renderOut(); } });
    $clear.addEventListener("click", () => { state.q = ""; $q.value = ""; $clear.style.display = "none"; renderOut(); $q.focus(); });
    document.getElementById("mic").addEventListener("click", onMic);
    renderOut();
  }
  function placeholder() {
    const c = state.cabin === "all" ? "the Onyx" : cabinOf(state.cabin).name;
    const ex = ["Does {c} have a dishwasher?", "What's the WiFi at {c}?", "How do guests get into {c}?", "Where do guests park at {c}?", "Is {c} pet friendly?", "How does the hot tub work at {c}?"];
    return ex[Math.floor(Date.now() / 60000) % ex.length].replace("{c}", c.replace(/^The /, "the "));
  }

  function renderOut() {
    const $out = document.getElementById("out");
    if (!state.q.trim()) { $out.innerHTML = renderHome(); bindCards($out); return; }
    const { results } = search(state.q);
    // cabin auto-detected from the question? reflect it in the chips
    $app.querySelectorAll("[data-cabin]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cabin === state.cabin)));
    if (!results.length) {
      $out.innerHTML = `<div class="empty"><h2>Nothing in The Base yet for that.</h2><p>${state.view === "guest" ? "Try the Team view, or " : ""}flag it so it gets added.</p><a class="btn" href="${flagHref(null, state.q)}">${ICON.flag} Flag a gap</a></div>`;
      return;
    }
    const scope = state.cabin === "all" ? "all cabins" : cabinOf(state.cabin).name;
    $out.innerHTML = `<div class="results-head"><span>${results.length} answer${results.length === 1 ? "" : "s"} · ${esc(scope)}</span>${state.cabin !== "all" ? `<button class="btn ghost" id="widen" style="padding:4px 10px">Search all cabins</button>` : ""}</div>
      <div class="results">${results.map(renderCard).join("")}</div>`;
    document.getElementById("widen")?.addEventListener("click", () => { setCabin("all", true); renderApp(); });
    bindCards($out);
  }
  function renderHome() {
    const quick = ["Check-in time", "WiFi", "Hot tub", "Directions", "Parking", "Pets", "Trash", "Dishwasher", "Coffee", "Firewood", "Late checkout", "TV", "Vehicle", "Grocery"];
    const counts = visibleFacts().length;
    if (state.cabin === "all") {
      return `<div class="home">
        <h2>Pick a cabin <em>or just ask.</em></h2>
        <div class="cabin-grid">${state.data.cabins.map((c) => `<button class="cabin-card" data-cabin="${c.slug}"><img src="${asset(c.photos[0]?.thumb || "")}" alt=""><div class="lbl"><b>${esc(c.name)}</b><span>Sleeps ${c.sleeps} · ${c.bedrooms} bd · ${c.bathrooms} ba</span></div></button>`).join("")}</div>
        <h2>Quick answers</h2>
        <div class="chips">${quick.map((q) => `<button class="chip q" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
        <p class="facts-line">${counts} facts loaded · ${state.view === "guest" ? "guest-safe only" : "team view"} · built ${esc((state.data.built_at || "").slice(0, 10))}</p>
      </div>`;
    }
    const c = cabinOf(state.cabin);
    return `<div class="home">
      <h2>${esc(c.name)}</h2>
      <p class="cabin-meta">Sleeps ${c.sleeps} · ${c.bedrooms} bd · ${c.bathrooms} ba · Check-in ${esc(c.check_in)} · Check-out ${esc(c.check_out)}</p>
      <div class="strip">${c.photos.map((p, i) => `<button data-photo="${c.slug}:${i}" aria-label="${esc(p.label)}"><img src="${asset(p.thumb)}" alt="${esc(p.label)}" loading="lazy"></button>`).join("")}</div>
      <h2>Quick answers</h2>
      <div class="chips">${quick.map((q) => `<button class="chip q" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
      <p class="facts-line">${counts} facts for ${esc(c.name)} · ${state.view === "guest" ? "guest-safe only" : "team view"}</p>
    </div>`;
  }
  function renderCard(f) {
    const c = cabinOf(f.cabin);
    const ph = photosFor(f);
    return `<article class="card" data-id="${f.id}">
      <div class="eyebrow"><span>${esc(c?.short || f.cabin)}</span><span class="cat">${esc(f.category)}</span>${f.audience === "internal" ? `<span class="badge internal">Internal</span>` : ""}</div>
      <h3>${esc(f.title)}</h3>
      <p class="ans">${linkify(f.answer)}</p>
      ${ph.length ? `<div class="photos">${ph.map((p) => `<button data-photo="${f.cabin}:${c.photos.indexOf(p)}" aria-label="${esc(p.label)}"><img src="${asset(p.thumb)}" alt="${esc(p.label)}" loading="lazy"></button>`).join("")}</div>` : ""}
      <div class="meta"><span class="badge ${f.verified}">${VER[f.verified] || f.verified}</span><span>${esc(f.source)}</span><span>Updated ${esc(f.updated)}</span></div>
      <div class="actions">
        <button class="btn" data-copy="${f.id}">${ICON.copy} Copy</button>
        <a class="btn ghost" href="${flagHref(f)}">${ICON.flag} Flag</a>
      </div>
    </article>`;
  }
  function flagHref(f, q) {
    const subj = f ? `The Base flag: ${cabinOf(f.cabin)?.name} — ${f.title}` : `The Base gap: "${q}"`;
    const body = f ? `Cabin: ${cabinOf(f.cabin)?.name}\nFact: ${f.title}\nCurrent answer: ${f.answer}\nSource: ${f.source}\n\nWhat's wrong / what should it say:\n` : `Question I asked: ${q}\nCabin filter: ${state.cabin}\n\nWhat the answer should be (if you know):\n`;
    return `mailto:${FLAG_TO}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  }
  function bindCards($root) {
    $root.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
      const f = state.data.facts.find((x) => x.id === b.dataset.copy);
      try { await navigator.clipboard.writeText(f.answer); } catch { const ta = document.createElement("textarea"); ta.value = f.answer; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
      b.classList.add("copied"); b.innerHTML = `${ICON.copy} Copied`; toast("Copied to clipboard"); setTimeout(() => { b.classList.remove("copied"); b.innerHTML = `${ICON.copy} Copy`; }, 1600);
    }));
    $root.querySelectorAll("[data-photo]").forEach((b) => b.addEventListener("click", () => { const [slug, i] = b.dataset.photo.split(":"); openLightbox(cabinOf(slug), +i); }));
    $root.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => { state.q = b.dataset.q; document.getElementById("q").value = state.q; document.getElementById("clear").style.display = ""; renderOut(); window.scrollTo({ top: 0, behavior: "smooth" }); }));
    $root.querySelectorAll(".cabin-card[data-cabin]").forEach((b) => b.addEventListener("click", () => { setCabin(b.dataset.cabin, true); renderApp(); }));
  }
  function openLightbox(cabin, i) {
    let idx = i;
    const n = cabin.photos.length;
    const box = document.createElement("div"); box.className = "lightbox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Photo");
    const prevOverflow = document.body.style.overflow;
    const go = (d) => { idx = (idx + d + n) % n; draw(); };
    const draw = () => {
      const p = cabin.photos[idx];
      box.innerHTML = `<div class="frame">
        <img src="${asset(p.file)}" alt="${esc(p.label)}">
        <div class="cap"><span class="txt">${esc(cabin.name)} · ${esc(p.label)} · ${idx + 1}/${n}</span>
          <div class="nav">${n > 1 ? `<button class="btn ghost" id="lbprev" aria-label="Previous photo">‹</button><button class="btn ghost" id="lbnext" aria-label="Next photo">›</button>` : ""}<button class="btn" id="lbclose">${ICON.x} Close</button></div>
        </div></div>`;
      box.querySelector("#lbclose").addEventListener("click", close);
      box.querySelector("#lbprev")?.addEventListener("click", () => go(-1));
      box.querySelector("#lbnext")?.addEventListener("click", () => go(1));
    };
    const close = () => { box.remove(); document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
    const onKey = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    let x0 = null;
    box.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); });
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    draw(); document.body.appendChild(box);
  }
  let toastT;
  function toast(msg) { const t = document.getElementById("toast"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800); }

  // ---------------- voice ----------------
  function onMic() {
    const $q = document.getElementById("q"), $mic = document.getElementById("mic");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (state.listening) { state.rec?.stop(); return; }
    if (!SR) { $q.focus(); toast("Tap the mic key on your keyboard to dictate"); return; }
    try {
      const rec = new SR(); rec.lang = "en-US"; rec.interimResults = true; rec.maxAlternatives = 1;
      state.rec = rec; state.listening = true; $mic.classList.add("listening"); $mic.setAttribute("aria-pressed", "true");
      rec.onresult = (e) => { const txt = Array.from(e.results).map((r) => r[0].transcript).join(" "); $q.value = txt; state.q = txt; document.getElementById("clear").style.display = ""; renderOut(); };
      rec.onerror = () => { $q.focus(); toast("Couldn't hear that. Use the mic key on your keyboard."); };
      rec.onend = () => { state.listening = false; $mic.classList.remove("listening"); $mic.setAttribute("aria-pressed", "false"); };
      rec.start(); toast("Listening…");
    } catch { $q.focus(); toast("Tap the mic key on your keyboard to dictate"); }
  }

  window.__thebase = { state, parseQuery, scoreFact, search, facts: () => state.data?.facts || [] };
  // ---------------- boot ----------------
  (async () => {
    $app.innerHTML = `<section class="lock"><div class="lock-inner"><img class="lock-mark" src="${asset("icons/mark-cream.png")}" alt=""><p class="sub">Loading…</p></div></section>`;
    try {
      const bundle = await fetchBundle();
      const data = await tryStoredKey(bundle);
      if (data) { state.data = data; renderApp(); } else renderLock();
    } catch (e) { renderLock("Couldn't load the knowledge base. Check your connection."); }
  })();
})();
