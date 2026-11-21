(() => {
"use strict";

/* ================= constants ================= */
const KEY = "routines-app-v2";
const RUNKEY = "routines-run-v2";
const COLORS = {teal:"#0f766e", blue:"#1d4ed8", indigo:"#4f46e5", plum:"#86198f", rose:"#be123c", clay:"#b45309", green:"#15803d", slate:"#334155"};
const COLOR_KEYS = Object.keys(COLORS);
/* Each palette recolors the routine colors, the accent and the text color used on top of them. */
const PALETTES = {
  sunny:    {name:"Sunny",    on:"#111111", gp:"100%", gmix:"#ffffff", accent:["#4338ca","#ffd60a"], ink:["#ffffff","#111111"],
             chrome:{bg:"#fff8dc", s2:"#fbeeb0", line:"#ebdc9a", muted:"#4f4a38", ink:"#14110a"},
             colors:{teal:"#35f0b0", blue:"#3fc1ff", indigo:"#b388ff", plum:"#ff7eb6", rose:"#ff7a70", clay:"#ffd60a", green:"#b6f23a", slate:"#ff9f1c"}},
  confetti: {name:"Confetti", on:"#061430", gp:"100%", gmix:"#ffffff", accent:["#9d174d","#ff7eb6"], ink:["#ffffff","#061430"],
             chrome:{bg:"#eaf6ff", s2:"#d4eafb", line:"#bfddf3", muted:"#3e4c66", ink:"#0a1f44"},
             colors:{teal:"#2de2e6", blue:"#4cc3ff", indigo:"#b388ff", plum:"#ff7eb6", rose:"#ff7a70", clay:"#ff9f1c", green:"#4be58a", slate:"#ffd60a"}},
  bright:   {name:"Bright",   on:"#111827", gp:"82%", gmix:"#000000", accent:["#111827","#facc15"], ink:["#ffffff","#111111"], colors:{teal:"#2dd4bf", blue:"#60a5fa", indigo:"#a78bfa", plum:"#e879f9", rose:"#fb7185", clay:"#fb923c", green:"#4ade80", slate:"#facc15"}},
  ocean:    {name:"Ocean",    on:"#ffffff", gp:"62%", gmix:"#000000", accent:["#0f766e","#2dd4bf"], ink:["#ffffff","#06201b"], colors:{teal:"#0f766e", blue:"#1d4ed8", indigo:"#4f46e5", plum:"#86198f", rose:"#be123c", clay:"#b45309", green:"#15803d", slate:"#334155"}},
  sunset:   {name:"Sunset",   on:"#ffffff", gp:"60%", gmix:"#000000", accent:["#c2410c","#fb923c"], ink:["#ffffff","#2a1204"], colors:{teal:"#9d174d", blue:"#b91c1c", indigo:"#be123c", plum:"#86198f", rose:"#a16207", clay:"#c2410c", green:"#78350f", slate:"#44403c"}},
  graphite: {name:"Graphite", on:"#ffffff", gp:"60%", gmix:"#000000", accent:["#111827","#e5e7eb"], ink:["#ffffff","#111827"], colors:{teal:"#111827", blue:"#374151", indigo:"#1f2937", plum:"#4b5563", rose:"#27272a", clay:"#3f3f46", green:"#52525b", slate:"#0f172a"}}
};
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const DAYFULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const PRESETS = [0,30,60,120,180,300,600,900,1200,1800];
const TEMPLATES = [
  {name:"Morning start", color:"clay", days:[1,2,3,4,5], steps:[["Drink a glass of water",0],["Stretch",300],["Plan the day",300]]},
  {name:"Evening wind-down", color:"indigo", days:[], steps:[["Tidy up",300],["Pack tomorrow's bag",0],["Read",900]]},
  {name:"Workout", color:"rose", days:[], steps:[["Warm up",300],["Main set",1500],["Cool down",300]]},
  {name:"Focus block", color:"teal", days:[], steps:[["Clear your desk",120],["Deep work",1500],["Break",300]]}
];

/* ================= small helpers ================= */
const $app = document.getElementById("app");
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic = (n, c = "") => `<svg class="i ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const rc = (c) => `--rc:${COLORS[c] || COLORS.teal}`;
const dayKey = (ts) => { const d = new Date(ts); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
const startOfDay = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const fmt = (sec) => { sec = Math.max(0, sec); const m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; };
function fmtDur(sec) {
  if (!sec) return "No timer";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h ? h + " h" : "", m ? m + " min" : "", s ? s + " sec" : ""].filter(Boolean).join(" ");
}
const presetLabel = (p) => p === 0 ? "None" : p < 60 ? p + " sec" : (p / 60) + " min";
const isStandalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/* ================= state ================= */
function seed() {
  return normalize({
    v: 2, updatedAt: 0, log: [],
    routines: TEMPLATES.slice(0, 2).map((t) => ({id: uid(), name: t.name, color: t.color, days: t.days, steps: t.steps.map(([name, secs]) => ({id: uid(), name, secs}))}))
  });
}
function normalize(o) {
  if (!o || typeof o !== "object" || !Array.isArray(o.routines)) return null;
  const st = (o.settings || {});
  const s = {
    v: 2, updatedAt: +o.updatedAt || 0, routines: [], log: [],
    settings: {sound: st.sound !== false, vibrate: st.vibrate !== false, auto: !!st.auto, wake: st.wake !== false, theme: ["light","dark"].includes(st.theme) ? st.theme : "system", hideInstall: !!st.hideInstall, palette: PALETTES[st.palette] ? st.palette : "sunny"}
  };
  o.routines.forEach((r, i) => {
    if (!r || !Array.isArray(r.steps)) return;
    const steps = r.steps.map((t) => ({id: String(t.id || uid()), name: String(t.name || "").slice(0, 80), secs: Math.max(0, Math.round(+t.secs || 0))})).filter((t) => t.name);
    s.routines.push({
      id: String(r.id || uid()), name: String(r.name || "Untitled routine").slice(0, 60),
      color: COLORS[r.color] ? r.color : COLOR_KEYS[i % COLOR_KEYS.length],
      days: (Array.isArray(r.days) ? r.days : []).filter((d) => d >= 0 && d <= 6), steps
    });
  });
  if (Array.isArray(o.log)) o.log.forEach((l) => {
    if (l && l.at) s.log.push({id: String(l.id || uid()), rid: String(l.rid || ""), name: String(l.name || ""), color: COLORS[l.color] ? l.color : "teal", at: +l.at, secs: +l.secs || 0, done: +l.done || 0, total: +l.total || 0});
  });
  s.log.sort((a, b) => b.at - a.at);
  return s;
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const n = normalize(JSON.parse(raw)); if (n) return n; } } catch (e) {}
  return seed();
}
let state = load();
function save() {
  state.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

let view = "home", lastView = "", sheet = null, sheetFresh = false;
let draft = null, run = null, savedRun = null, timer = null, wake = null, audioCtx = null, deferredPrompt = null;
let pendingFocus = null, confirmKey = null;

/* ================= selectors ================= */
const routineById = (id) => state.routines.find((r) => r.id === id);
const total = (r) => r.steps.reduce((a, s) => a + s.secs, 0);
function doneToday() { const k = dayKey(Date.now()), m = {}; state.log.forEach((l) => { if (dayKey(l.at) === k) m[l.rid] = 1; }); return m; }
function daysLabel(r) {
  if (!r.days.length) return "";
  if (r.days.length === 7) return "Every day";
  return r.days.slice().sort().map((d) => DAYS[d]).join(" ");
}
function relDay(ts) {
  const n = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 864e5);
  return n <= 0 ? "Today" : n === 1 ? "Yesterday" : n + " days ago";
}
function streak() {
  const set = {}; state.log.forEach((l) => { set[dayKey(l.at)] = 1; });
  const d = new Date(); d.setHours(12, 0, 0, 0);
  if (!set[dayKey(d.getTime())]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set[dayKey(d.getTime())]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function countsByDay() { const m = {}; state.log.forEach((l) => { const k = dayKey(l.at); m[k] = (m[k] || 0) + 1; }); return m; }

/* ================= feedback ================= */
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
function vib(p) { if (state.settings.vibrate) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} } }
function beep() {
  if (state.settings.sound) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      [0, 0.28, 0.56].forEach((t) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = 880; g.gain.value = 0.18; o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.16);
      });
    } catch (e) {}
  }
  vib([220, 110, 220]);
}
function isDark() {
  const t = state.settings.theme;
  return t === "dark" || (t === "system" && !!window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}
function applyPalette() {
  const P = PALETTES[state.settings.palette] || PALETTES.sunny, st = document.documentElement.style, d = isDark() ? 1 : 0;
  Object.assign(COLORS, P.colors);
  st.setProperty("--on", P.on); st.setProperty("--gp", P.gp); st.setProperty("--gmix", P.gmix);
  st.setProperty("--accent", P.accent[d]); st.setProperty("--accent-ink", P.ink[d]);
  const ch = !d && P.chrome;
  [["--bg", "bg"], ["--surface-2", "s2"], ["--line", "line"], ["--muted", "muted"], ["--ink", "ink"]].forEach(([v, k]) => { if (ch) st.setProperty(v, ch[k]); else st.removeProperty(v); });
  [[10, .16], [14, .22], [16, .24], [18, .32], [22, .42], [25, .4], [50, .6], [65, .78], [80, .9]].forEach(([k, a]) => st.setProperty("--a" + k, rgba("#ffffff", a)));
}
function applyTheme() {
  const t = state.settings.theme, root = document.documentElement;
  if (t === "light" || t === "dark") root.setAttribute("data-theme", t); else root.removeAttribute("data-theme");
  applyPalette();
}
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const running = (view === "run" || view === "done") && run;
  document.documentElement.style.backgroundColor = running ? (COLORS[run.color] || COLORS.teal) : "";
  document.body.style.backgroundColor = running ? (COLORS[run.color] || COLORS.teal) : "";
  meta.setAttribute("content", running ? (COLORS[run.color] || COLORS.teal) : getComputedStyle(document.body).backgroundColor);
}

/* ================= views ================= */
function weekStripHtml() {
  const counts = countsByDay(), cells = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const on = counts[dayKey(d.getTime())], now = i === 0;
    cells.push(`<div class="d7${on ? " on" : ""}${now ? " now" : ""}"><span>${DAYS[d.getDay()][0]}</span><i>${on ? ic("check") : ""}</i></div>`);
  }
  const s = streak();
  return `<div class="week" aria-label="Last 7 days"><div class="days7">${cells.join("")}</div>${s ? `<div class="streak" title="Day streak">${ic("flame")}${s}</div>` : ""}</div>`;
}
function heroHtml(r) {
  const sched = r.days.includes(new Date().getDay());
  const tot = total(r);
  return `<section class="hero" style="${rc(r.color)}"><span class="tag">${sched ? "Scheduled today" : "Up next"}</span>
    <h2>${esc(r.name)}</h2>
    <p class="meta">${r.steps.length} step${r.steps.length === 1 ? "" : "s"}${tot ? " · " + fmtDur(tot) : ""}</p>
    <div class="peek">${r.steps.slice(0, 3).map((s) => `<span>${esc(s.name)}</span>`).join("")}${r.steps.length > 3 ? `<span>+${r.steps.length - 3}</span>` : ""}</div>
    <div class="acts"><button class="go" data-a="start" data-id="${esc(r.id)}">${ic("play")}Start</button><button class="more" data-a="open" data-id="${esc(r.id)}">Details</button></div></section>`;
}
function resumeHtml(r) {
  const done = savedRun.res.filter(Boolean).length;
  return `<section class="hero" style="${rc(r.color)}"><span class="tag">In progress</span>
    <h2>${esc(r.name)}</h2><p class="meta">${done} of ${r.steps.length} steps finished</p>
    <div class="acts"><button class="go" data-a="resume">${ic("play")}Resume</button><button class="more" data-a="discardRun">Discard</button></div></section>`;
}
function rowHtml(r, dt) {
  const tot = total(r), dl = daysLabel(r), done = dt[r.id];
  return `<div class="row" style="${rc(r.color)}"><span class="bar"></span>
    <button class="main" data-a="open" data-id="${esc(r.id)}"><span class="txt"><b>${esc(r.name)}</b>
    <small>${r.steps.length} step${r.steps.length === 1 ? "" : "s"}${tot ? " · " + fmtDur(tot) : ""}${dl ? " · " + esc(dl) : ""}</small></span></button>
    <button class="play${done ? " done" : ""}" data-a="start" data-id="${esc(r.id)}" aria-label="Start ${esc(r.name)}">${ic(done ? "check" : "play")}</button></div>`;
}
function homeHtml() {
  const dt = doneToday(), t = new Date().getDay();
  const rank = (r) => dt[r.id] ? 2 : (r.days.includes(t) ? 0 : 1);
  const list = state.routines.slice().sort((a, b) => rank(a) - rank(b));
  let hero = "", exclude = null;
  const sr = savedRun && routineById(savedRun.rid);
  if (sr) { hero = resumeHtml(sr); exclude = sr.id; }
  else {
    const next = list.find((r) => !dt[r.id]);
    if (next) { hero = heroHtml(next); exclude = next.id; }
    else if (state.routines.length) hero = `<section class="hero rest"><span class="tag">All done</span><h2 style="margin-top:14px">Everything is done for today</h2><p class="meta" style="margin-top:6px;color:var(--muted)">${streak() > 1 ? streak() + " days in a row. Keep it going tomorrow." : "Nice work. Rest up."}</p></section>`;
  }
  const rows = list.filter((r) => r.id !== exclude).map((r) => rowHtml(r, dt)).join("");
  const date = new Date().toLocaleDateString(undefined, {weekday: "long", month: "long", day: "numeric"});
  let note = "";
  if (!isStandalone() && !state.settings.hideInstall) {
    const how = deferredPrompt ? `<button class="btn primary sm" data-a="install" style="margin-top:8px">Install</button>` : isIOS() ? "In Safari, tap Share, then Add to Home Screen." : "Open the browser menu and choose Install app or Add to Home screen.";
    note = `<div class="note"><div><b>Use it like a normal app</b><span class="muted">Install Routines for full screen and offline use. </span>${deferredPrompt ? how : `<span class="muted">${how}</span>`}</div><button class="x" data-a="hideInstall" aria-label="Dismiss">${ic("x", "sm")}</button></div>`;
  }
  return `<header class="top"><div><p class="eyebrow">${esc(date)}</p><h1 class="title">Today</h1></div>
    <div style="display:flex;gap:8px"><button class="round" data-a="new" aria-label="New routine">${ic("plus")}</button><button class="round" data-a="settings" aria-label="Settings">${ic("sliders")}</button></div></header>
    ${weekStripHtml()}
    <main class="pad">${hero}
    ${rows ? `<div class="sec-h"><h2>${hero ? "Other routines" : "Your routines"}</h2></div><div class="rows">${rows}</div>` : ""}
    ${!state.routines.length ? `<p class="empty">No routines yet. Start from a template or build your own.</p>` : ""}
    <button class="add" data-a="new">${ic("plus", "sm")}New routine</button>${note}</main>`;
}

function progressHtml() {
  const now = Date.now(), week = state.log.filter((l) => l.at >= now - 7 * 864e5).length;
  const secs = state.log.reduce((a, l) => a + l.secs, 0);
  const counts = countsByDay();
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) - 28);
  const todayStart = startOfDay(now);
  let heat = ["M","T","W","T","F","S","S"].map((d) => `<div class="hd">${d}</div>`).join("");
  for (let i = 0; i < 35; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    const c = counts[dayKey(d.getTime())] || 0, fut = d.getTime() > todayStart, nowc = d.getTime() === todayStart;
    heat += `<div class="hc${fut ? " fut" : c >= 3 ? " h3" : c === 2 ? " h2" : c === 1 ? " h1" : ""}${nowc ? " now" : ""}" title="${d.toLocaleDateString()}: ${c}"></div>`;
  }
  const groups = {}, order = [];
  state.log.slice(0, 120).forEach((l) => { const k = dayKey(l.at); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(l); });
  const body = order.map((k) => {
    const f = groups[k][0], label = relDay(f.at) !== "Today" && relDay(f.at) !== "Yesterday" ? new Date(f.at).toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"}) : relDay(f.at);
    return `<h3 class="day-h">${esc(label)}</h3>` + groups[k].map((l) => `<div class="log" style="${rc(l.color)}"><span class="dot"></span><div class="t"><b>${esc(l.name)}</b><small>${new Date(l.at).toLocaleTimeString(undefined, {hour: "numeric", minute: "2-digit"})}</small></div><div class="r">${l.done}/${l.total} steps<small>${fmt(l.secs)}</small></div></div>`).join("");
  }).join("");
  return `<header class="top"><div><p class="eyebrow">Completed runs</p><h1 class="title">Progress</h1></div><button class="round" data-a="settings" aria-label="Settings">${ic("sliders")}</button></header>
    <main class="pad"><div class="tiles"><div class="tile"><b>${streak()}</b><span>Day streak</span></div><div class="tile"><b>${week}</b><span>Runs, last 7 days</span></div><div class="tile"><b>${state.log.length}</b><span>Runs, all time</span></div><div class="tile"><b>${secs >= 3600 ? (secs / 3600).toFixed(1) + "h" : Math.round(secs / 60) + "m"}</b><span>Time spent</span></div></div>
    <div class="card"><h2 style="font-size:18px">Last 5 weeks</h2><div class="heat" role="img" aria-label="Calendar of days with completed routines">${heat}</div></div>
    ${body || `<p class="empty">Finish a routine and it shows up here.</p>`}</main>`;
}

function timerPanel(s, i) {
  const m = Math.floor(s.secs / 60), sec = s.secs % 60;
  return `<div class="tpanel"><div class="presets" role="group" aria-label="Timer presets">${PRESETS.map((p) => `<button data-a="preset" data-i="${i}" data-v="${p}" aria-pressed="${s.secs === p}">${presetLabel(p)}</button>`).join("")}</div>
    <div class="custom">Custom <input class="num-in" type="number" inputmode="numeric" min="0" max="999" data-s="${i}" data-k="m" value="${m || ""}" placeholder="0" aria-label="Minutes">min
    <input class="num-in" type="number" inputmode="numeric" min="0" max="59" data-s="${i}" data-k="s" value="${sec || ""}" placeholder="0" aria-label="Seconds">sec</div></div>`;
}
function stepRow(s, i, n) {
  const open = draft.open === i;
  return `<li class="step"><div class="r1"><span class="num">${i + 1}</span>
    <input class="sin" id="s${i}" data-s="${i}" data-k="name" value="${esc(s.name)}" placeholder="Name this step" maxlength="80" autocomplete="off" aria-label="Step ${i + 1} name"></div>
    <div class="r2"><button class="pill" id="pill${i}" data-a="timer" data-i="${i}" aria-expanded="${open}">${ic("clock", "sm")}<span>${fmtDur(s.secs)}</span></button>
    <div class="mini"><button data-a="up" data-i="${i}" aria-label="Move step up"${i === 0 ? " disabled" : ""}>${ic("up", "sm")}</button><button data-a="down" data-i="${i}" aria-label="Move step down"${i === n - 1 ? " disabled" : ""}>${ic("down", "sm")}</button><button class="rm" data-a="rm" data-i="${i}" aria-label="Remove step">${ic("x", "sm")}</button></div></div>
    ${open ? timerPanel(s, i) : ""}</li>`;
}
function editHtml() {
  const d = draft;
  return `<div style="${rc(d.color)};display:flex;flex-direction:column;flex:1">
    <div class="ed-top"><button class="round" data-a="cancel" aria-label="Close without saving">${ic("x")}</button><h1>${d.isNew ? "New routine" : "Edit routine"}</h1><button class="btn solid sm" data-a="save">Save</button></div>
    <main class="pad">
    ${d.isNew ? `<div><p class="lbl">Start from a template</p><div class="hscroll" style="margin-top:8px">${TEMPLATES.map((t, i) => `<button class="tchip" data-a="tpl" data-i="${i}">${esc(t.name)}</button>`).join("")}</div></div>` : ""}
    <div><label class="sr" for="rname">Routine name</label><input class="name-in" id="rname" data-f="name" value="${esc(d.name)}" placeholder="Name your routine" maxlength="60" autocomplete="off"></div>
    <p class="lbl">Color</p>
    <div class="swatches" role="radiogroup" aria-label="Color">${COLOR_KEYS.map((k, n) => `<button class="sw-c" style="--c:${COLORS[k]}" role="radio" aria-checked="${d.color === k}" aria-label="Color ${n + 1}" data-a="color" data-k="${k}">${ic("check", "sm")}</button>`).join("")}</div>
    <p class="lbl">Days<small>Optional. Scheduled routines are suggested first on those days.</small></p>
    <div class="days">${DAYS.map((n, i) => `<button class="dchip" data-a="day" data-i="${i}" aria-pressed="${d.days.includes(i)}" aria-label="${DAYFULL[i]}">${n}</button>`).join("")}</div>
    <p class="lbl">Steps<small>Tap the timer to set a countdown. Steps without a timer wait for you to tap Done.</small></p>
    <ol class="steps">${d.steps.map((s, i) => stepRow(s, i, d.steps.length)).join("")}</ol>
    <button class="add" data-a="addStep">${ic("plus", "sm")}Add step</button>
    ${d.err ? `<p class="err" role="alert">${esc(d.err)}</p>` : ""}
    ${d.isNew ? "" : `<div class="dz"><button class="btn sec" data-a="dup">${ic("copy", "sm")}Duplicate</button><button class="btn sec danger" data-a="del">${ic("trash", "sm")}${confirmKey === "del" ? "Tap to confirm" : "Delete"}</button></div>`}
    </main></div>`;
}

const RING = 2 * Math.PI * 96;
function runHtml() {
  const st = run.steps[run.idx], timed = st.secs > 0, last = run.idx === run.steps.length - 1;
  const ring = timed
    ? `<div class="ring" id="ring"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="rbg" cx="110" cy="110" r="96"/><circle id="ringFg" class="rfg" cx="110" cy="110" r="96" stroke-dasharray="${RING}" stroke-dashoffset="0" transform="rotate(-90 110 110)"/></svg><div class="rt"><span id="timeTxt" class="time" role="timer">0:00</span><span id="timeSub" class="tsub"></span></div></div>`
    : `<div class="ring"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="rbg" cx="110" cy="110" r="96"/></svg><div class="rt"><svg class="i lg still" style="width:64px;height:64px;stroke-width:2.5" aria-hidden="true"><use href="#i-check"/></svg><span class="tsub">No timer</span></div></div>`;
  return `<div class="run" style="${rc(run.color)}">
    <header class="top"><button class="glass" data-a="endAsk" aria-label="End routine">${ic("x")}</button><span class="rname">${esc(run.name)}</span><span class="cnt">${run.idx + 1}/${run.steps.length}</span></header>
    <div class="segs" aria-hidden="true">${run.steps.map((_, i) => `<i class="${i < run.idx ? "d" : i === run.idx ? "c" : ""}"></i>`).join("")}</div>
    <main class="rbody"><p class="eyebrow">Step ${run.idx + 1} of ${run.steps.length}</p><h2 class="rstep">${esc(st.name)}</h2>${ring}
    <p class="next">${last ? "Last step" : "Next: " + esc(run.steps[run.idx + 1].name)}</p></main>
    <footer class="rctl"><button class="bigdone" id="doneBtn" data-a="done">${ic("check")}${last ? "Finish" : "Done"}</button>
    <div class="tools"><button class="tool" data-a="back"${run.idx === 0 ? " disabled" : ""}><span class="c">${ic("prev", "sm")}</span>Back</button>
    ${timed ? `<button class="tool" data-a="pause"><span class="c">${ic(run.paused ? "play" : "pause", "sm")}</span>${run.paused ? "Resume" : "Pause"}</button><button class="tool" data-a="plus"><span class="c">+1m</span>Add time</button>` : ""}
    <button class="tool" data-a="skip"><span class="c">${ic("next", "sm")}</span>Skip</button></div></footer></div>`;
}
function doneHtml() {
  const c = run.summary, s = streak();
  return `<div class="run" style="${rc(run.color)}"><div class="fin">
    <svg class="big" viewBox="0 0 100 100" aria-hidden="true"><circle class="ringdone" cx="50" cy="50" r="45"/><circle class="arc" cx="50" cy="50" r="45" transform="rotate(-90 50 50)"/><path class="tick" d="M30 52l14 14 27-30"/></svg>
    <p class="eyebrow" style="color:rgba(255,255,255,.8)">Complete</p><h1>${esc(c.name)}</h1>
    <div class="fstats"><div><b>${c.done}/${c.total}</b><span>Steps</span></div><div><b>${fmt(c.secs)}</b><span>Time</span></div>${s > 1 ? `<div><b>${s}</b><span>Day streak</span></div>` : ""}</div>
    <button class="bigdone" style="max-width:320px" data-a="finish">Back to routines</button></div></div>`;
}

function sheetHtml() {
  const fresh = sheetFresh ? " enter" : "";
  if (sheet.type === "detail") {
    const r = routineById(sheet.id); if (!r) return "";
    const runs = state.log.filter((l) => l.rid === r.id), tot = total(r), dl = daysLabel(r);
    return `<div class="scrim" data-a="closeSheet"><div class="panel${fresh}" style="${rc(r.color)}" role="dialog" aria-modal="true" aria-label="${esc(r.name)}"><div class="grab"></div>
      <div class="sh-head"><span class="colorbar"></span><div class="t"><h2>${esc(r.name)}</h2><p class="muted" style="margin-top:6px">${r.steps.length} step${r.steps.length === 1 ? "" : "s"}${tot ? " · " + fmtDur(tot) : ""}${dl ? " · " + esc(dl) : ""}</p>
      <p class="muted">${runs.length ? "Done " + runs.length + (runs.length === 1 ? " time" : " times") + " · last " + relDay(runs[0].at).toLowerCase() : "Not run yet"}</p></div></div>
      <ol class="ol">${r.steps.map((s, i) => `<li><span class="n">${i + 1}</span><span class="nm">${esc(s.name)}</span><span class="du">${s.secs ? fmtDur(s.secs) : ""}</span></li>`).join("")}</ol>
      <button class="btn solid block" style="min-height:56px;font-size:17px" data-a="start" data-id="${esc(r.id)}">${ic("play", "sm")}Start routine</button>
      <button class="btn sec block" data-a="edit" data-id="${esc(r.id)}">${ic("edit", "sm")}Edit</button></div></div>`;
  }
  if (sheet.type === "end") {
    return `<div class="scrim" data-a="closeSheet"><div class="panel${fresh}" role="dialog" aria-modal="true" aria-label="End routine"><div class="grab"></div>
      <h2>End this routine?</h2><p class="muted">Your progress on this run won't be saved.</p>
      <button class="btn primary block" data-a="closeSheet">Keep going</button><button class="btn sec danger block" data-a="endNow">End without saving</button></div></div>`;
  }
  const S = state.settings;
  const sw = (k, label, sub) => `<div class="set"><div>${label}<small>${sub}</small></div><button class="switch" role="switch" aria-checked="${S[k]}" aria-label="${label}" data-a="tg" data-k="${k}"></button></div>`;
  return `<div class="scrim" data-a="closeSheet"><div class="panel${fresh}" role="dialog" aria-modal="true" aria-label="Settings"><div class="grab"></div>
    <div class="sh-head"><h2>Settings</h2><button class="round" data-a="closeSheet" aria-label="Close">${ic("x")}</button></div>
    <p class="lbl">Palette</p>
    <div class="pals">${Object.entries(PALETTES).map(([k, p]) => `<button class="pal" data-a="palette" data-v="${k}" aria-pressed="${S.palette === k}"><span class="sws">${Object.values(p.colors).slice(0, 6).map((c) => `<i style="background:${c}"></i>`).join("")}</span>${p.name}</button>`).join("")}</div>
    <p class="lbl">Appearance</p>
    <div class="seg" role="group" aria-label="Theme">${["system", "light", "dark"].map((t) => `<button data-a="theme" data-v="${t}" aria-pressed="${S.theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>
    ${sw("sound", "Sound", "Beep when a timer ends")}${sw("vibrate", "Vibration", "Buzz when a timer ends (Android)")}${sw("auto", "Auto-advance", "Move on when a timer ends")}${sw("wake", "Keep screen on", "While a routine is running")}
    <p class="lbl" style="margin-top:6px">Your data<small>Routines are stored on this device only. Export a backup now and then, or to move to a new phone.</small></p>
    <div class="grid2"><button class="btn sec" data-a="export">${ic("download", "sm")}Export</button><label class="btn sec" for="importFile" style="cursor:pointer">${ic("upload", "sm")}Import</label></div>
    <input type="file" id="importFile" accept="application/json,.json" class="sr">
    <details><summary>Copy or paste backup text</summary><div style="display:flex;flex-direction:column;gap:8px;padding-top:6px">
      <button class="btn sec" data-a="copy">${ic("copy", "sm")}Copy backup text</button>
      <textarea class="paste" id="pasteText" placeholder="Paste backup text here" aria-label="Backup text"></textarea>
      <button class="btn sec" data-a="restore">Restore from text</button></div></details>
    ${deferredPrompt && !isStandalone() ? `<button class="btn primary block" data-a="install">Install app</button>` : ""}
    <button class="btn sec danger block" data-a="clearHistory">${confirmKey === "clear" ? "Tap again to clear history" : "Clear history"}</button>
    <p class="muted" style="text-align:center">Routines 1.0</p></div></div>`;
}

function render() {
  const y = window.scrollY, pn = $app.querySelector(".panel"), py = pn ? pn.scrollTop : 0;
  let html = "", nav = false;
  if (view === "home") { html = homeHtml(); nav = true; }
  else if (view === "progress") { html = progressHtml(); nav = true; }
  else if (view === "edit") html = editHtml();
  else if (view === "run") html = runHtml();
  else if (view === "done") html = doneHtml();
  if (nav) html += `<nav class="tabs" aria-label="Main"><div class="in"><button data-a="tab" data-t="home"${view === "home" ? ' aria-current="page"' : ""}>${ic("list")}Routines</button><button data-a="tab" data-t="progress"${view === "progress" ? ' aria-current="page"' : ""}>${ic("chart")}Progress</button></div></nav>`;
  if (sheet) html += sheetHtml();
  $app.innerHTML = html;
  sheetFresh = false;
  const p = $app.querySelector(".panel"); if (p) p.scrollTop = py;
  window.scrollTo(0, view === lastView ? y : 0);
  lastView = view;
  syncThemeColor();
  if (view === "run") updateTimer();
  if (pendingFocus) { const el = document.getElementById(pendingFocus); if (el) el.focus({preventScroll: false}); pendingFocus = null; }
}
const go = (v) => { view = v; sheet = null; confirmKey = null; render(); };
const openSheet = (s) => { sheet = s; sheetFresh = true; render(); };
const closeSheet = () => { sheet = null; confirmKey = null; render(); };

/* ================= runner ================= */
const remaining = () => run.paused ? run.remainMs : Math.max(0, run.endAt - Date.now());
function startStep(i) {
  run.idx = i; const st = run.steps[i];
  run.paused = false; run.fired = false;
  if (st.secs > 0) { run.totalMs = st.secs * 1000; run.remainMs = run.totalMs; run.endAt = Date.now() + run.totalMs; }
  persistRun();
}
function persistRun() {
  try {
    if (!run || view === "done") { localStorage.removeItem(RUNKEY); return; }
    localStorage.setItem(RUNKEY, JSON.stringify({rid: run.rid, idx: run.idx, res: run.res, startedAt: run.startedAt, paused: run.paused, remainMs: run.remainMs, endAt: run.endAt, totalMs: run.totalMs}));
  } catch (e) {}
}
function loadSavedRun() {
  try {
    const raw = localStorage.getItem(RUNKEY); if (!raw) return;
    const o = JSON.parse(raw), r = routineById(o.rid);
    if (!r || !r.steps.length || Date.now() - o.startedAt > 12 * 36e5) { localStorage.removeItem(RUNKEY); return; }
    savedRun = o;
  } catch (e) {}
}
function requestWake() {
  if (!state.settings.wake || wake || !navigator.wakeLock) return;
  navigator.wakeLock.request("screen").then((w) => { wake = w; w.addEventListener("release", () => { wake = null; }); }).catch(() => {});
}
function stopRunInfra() {
  clearInterval(timer); timer = null;
  try { if (wake) { wake.release(); wake = null; } } catch (e) {}
}
function beginRun(r, resume) {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.resume) audioCtx.resume(); } catch (e) {}
  run = {rid: r.id, name: r.name, color: r.color, steps: r.steps.slice(), res: [], startedAt: Date.now(), paused: false, fired: false, remainMs: 0, endAt: 0, totalMs: 0};
  if (resume) {
    run.res = resume.res.slice(0, run.steps.length); run.startedAt = resume.startedAt;
    const i = Math.min(resume.idx, run.steps.length - 1);
    if (run.steps[i].secs > 0 && resume.totalMs > 0) { run.idx = i; run.totalMs = resume.totalMs; run.paused = !!resume.paused; run.remainMs = resume.remainMs; run.endAt = resume.endAt; persistRun(); }
    else startStep(i);
  } else startStep(0);
  savedRun = null; sheet = null; confirmKey = null; view = "run"; render();
  requestWake();
  clearInterval(timer); timer = setInterval(updateTimer, 250);
}
function updateTimer() {
  if (!run || view !== "run") return;
  const st = run.steps[run.idx]; if (!(st.secs > 0)) return;
  const rem = remaining(), txt = document.getElementById("timeTxt"), fg = document.getElementById("ringFg"), sub = document.getElementById("timeSub"), ring = document.getElementById("ring");
  if (txt) txt.textContent = fmt(Math.ceil(rem / 1000));
  if (fg) fg.style.strokeDashoffset = String(RING * Math.min(1, Math.max(0, 1 - rem / run.totalMs)));
  if (sub) sub.textContent = run.paused ? "Paused" : rem <= 0 ? "Time's up" : "";
  if (ring) ring.classList.toggle("up", rem <= 0 && !run.paused);
  if (rem <= 0 && !run.paused && !run.fired) {
    run.fired = true; beep();
    if (state.settings.auto) advance("done");
    else { const b = document.getElementById("doneBtn"); if (b) b.classList.add("pulse"); }
  }
}
function advance(kind) {
  run.res[run.idx] = kind;
  if (run.idx + 1 < run.steps.length) { startStep(run.idx + 1); render(); } else finishRun();
}
function finishRun() {
  stopRunInfra();
  const done = run.res.filter((r) => r === "done").length, tot = run.steps.length, secs = Math.round((Date.now() - run.startedAt) / 1000);
  state.log.unshift({id: uid(), rid: run.rid, name: run.name, color: run.color, at: Date.now(), secs, done, total: tot});
  if (state.log.length > 1000) state.log.length = 1000;
  save();
  run.summary = {name: run.name, done, total: tot, secs};
  vib([60, 40, 60]);
  view = "done"; persistRun(); render();
}

/* ================= editor ================= */
function openEditor(id) {
  const r = id ? routineById(id) : null;
  draft = r
    ? {id: r.id, isNew: false, name: r.name, color: r.color, days: r.days.slice(), open: -1, err: "", steps: r.steps.map((s) => ({id: s.id, name: s.name, secs: s.secs}))}
    : {id: uid(), isNew: true, name: "", color: COLOR_KEYS[state.routines.length % COLOR_KEYS.length], days: [], open: -1, err: "", steps: [{id: uid(), name: "", secs: 0}]};
  sheet = null; confirmKey = null; view = "edit";
  if (!r) pendingFocus = "rname";
  render();
}
function commitDraft() {
  const d = draft;
  const steps = d.steps.map((s) => ({id: s.id, name: s.name.trim(), secs: Math.max(0, s.secs | 0)})).filter((s) => s.name);
  if (!steps.length) return null;
  return {id: d.id, name: d.name.trim() || "Untitled routine", color: d.color, days: d.days.slice().sort(), steps};
}
function upsert(r) {
  const i = state.routines.findIndex((x) => x.id === r.id);
  if (i >= 0) state.routines[i] = r; else state.routines.push(r);
}

/* ================= backup ================= */
function stamp() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function exportFile() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type: "application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "routines-backup-" + stamp() + ".json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast("Backup file saved");
}
function importText(txt) {
  let n = null; try { n = normalize(JSON.parse(txt)); } catch (e) {}
  if (!n || !n.routines.length) { toast("That backup isn't valid."); return false; }
  state = n; save(); applyTheme(); sheet = null; view = "home"; render(); toast("Backup restored"); return true;
}

/* ================= actions ================= */
function act(a, ds) {
  if (!["del", "clearHistory"].includes(a)) confirmKey = null;
  const i = ds.i !== undefined ? +ds.i : null;
  switch (a) {
    case "tab": go(ds.t); break;
    case "new": openEditor(null); break;
    case "edit": openEditor(ds.id); break;
    case "open": openSheet({type: "detail", id: ds.id}); break;
    case "start": { const r = routineById(ds.id); if (r && r.steps.length) beginRun(r); break; }
    case "resume": { const r = savedRun && routineById(savedRun.rid); if (r) beginRun(r, savedRun); break; }
    case "discardRun": savedRun = null; persistRunClear(); render(); break;
    case "settings": openSheet({type: "settings"}); break;
    case "closeSheet": closeSheet(); break;
    case "hideInstall": state.settings.hideInstall = true; save(); render(); break;
    case "install": if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.finally(() => { deferredPrompt = null; render(); }); } break;
    case "tg": state.settings[ds.k] = !state.settings[ds.k]; save(); render(); break;
    case "palette": state.settings.palette = ds.v; save(); applyPalette(); render(); break;
    case "theme": state.settings.theme = ds.v; save(); applyTheme(); render(); break;
    case "export": exportFile(); break;
    case "copy": {
      const txt = JSON.stringify(state);
      const fb = () => { const ta = document.getElementById("pasteText"); if (ta) { ta.value = txt; ta.focus(); ta.select(); } toast("Copy blocked. Select the text in the box and copy it."); };
      try { navigator.clipboard.writeText(txt).then(() => toast("Backup text copied"), fb); } catch (e) { fb(); }
      break;
    }
    case "restore": importText((document.getElementById("pasteText") || {}).value || ""); break;
    case "clearHistory":
      if (confirmKey === "clear") { state.log = []; save(); confirmKey = null; render(); toast("History cleared"); }
      else { confirmKey = "clear"; render(); }
      break;
    /* editor */
    case "cancel": draft = null; go("home"); break;
    case "color": draft.color = ds.k; render(); break;
    case "day": { const k = draft.days.indexOf(i); if (k >= 0) draft.days.splice(k, 1); else draft.days.push(i); render(); break; }
    case "tpl": {
      const t = TEMPLATES[i];
      draft.name = t.name; draft.color = t.color; draft.days = t.days.slice(); draft.open = -1;
      draft.steps = t.steps.map(([name, secs]) => ({id: uid(), name, secs})); render(); break;
    }
    case "addStep": draft.steps.push({id: uid(), name: "", secs: 0}); draft.open = -1; pendingFocus = "s" + (draft.steps.length - 1); render(); break;
    case "rm": draft.steps.splice(i, 1); if (!draft.steps.length) draft.steps.push({id: uid(), name: "", secs: 0}); draft.open = -1; render(); break;
    case "up": if (i > 0) { [draft.steps[i - 1], draft.steps[i]] = [draft.steps[i], draft.steps[i - 1]]; draft.open = -1; } render(); break;
    case "down": if (i < draft.steps.length - 1) { [draft.steps[i + 1], draft.steps[i]] = [draft.steps[i], draft.steps[i + 1]]; draft.open = -1; } render(); break;
    case "timer": draft.open = draft.open === i ? -1 : i; render(); break;
    case "preset": draft.steps[i].secs = +ds.v; render(); break;
    case "save": {
      const r = commitDraft();
      if (!r) { draft.err = "Add at least one step with a name."; render(); break; }
      upsert(r); save(); draft = null; go("home"); toast("Routine saved"); break;
    }
    case "dup": {
      const r = commitDraft(); if (!r) { draft.err = "Add at least one step with a name."; render(); break; }
      upsert(r);
      state.routines.push({id: uid(), name: r.name + " copy", color: r.color, days: r.days.slice(), steps: r.steps.map((s) => ({id: uid(), name: s.name, secs: s.secs}))});
      save(); draft = null; go("home"); toast("Routine duplicated"); break;
    }
    case "del":
      if (confirmKey === "del") { state.routines = state.routines.filter((x) => x.id !== draft.id); save(); draft = null; go("home"); toast("Routine deleted"); }
      else { confirmKey = "del"; render(); }
      break;
    /* runner */
    case "done": vib(15); advance("done"); break;
    case "skip": advance("skip"); break;
    case "back": if (run.idx > 0) { run.res[run.idx - 1] = undefined; startStep(run.idx - 1); render(); } break;
    case "pause":
      if (run.paused) { run.endAt = Date.now() + run.remainMs; run.paused = false; } else { run.remainMs = remaining(); run.paused = true; }
      persistRun(); render(); break;
    case "plus": {
      const base = remaining();
      if (run.paused) run.remainMs = base + 60000; else run.endAt = Date.now() + base + 60000;
      run.totalMs = Math.max(run.totalMs, base + 60000); run.fired = false; persistRun(); render(); break;
    }
    case "endAsk": openSheet({type: "end"}); break;
    case "endNow": stopRunInfra(); run = null; persistRunClear(); go("home"); break;
    case "finish": run = null; persistRunClear(); go("home"); break;
  }
}
function persistRunClear() { savedRun = null; try { localStorage.removeItem(RUNKEY); } catch (e) {} }

/* ================= events ================= */
$app.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  if (b.dataset.a === "closeSheet" && b.classList.contains("scrim") && e.target !== b) return;
  act(b.dataset.a, b.dataset);
});
$app.addEventListener("input", (e) => {
  const t = e.target; if (!draft) return;
  if (t.dataset.f === "name") draft.name = t.value;
  else if (t.dataset.s !== undefined) {
    const s = draft.steps[+t.dataset.s], k = t.dataset.k;
    if (k === "name") s.name = t.value;
    else {
      const m = Math.floor(s.secs / 60), sec = s.secs % 60;
      const v = Math.max(0, parseInt(t.value, 10) || 0);
      s.secs = k === "m" ? Math.min(999, v) * 60 + sec : m * 60 + Math.min(59, v);
      const pill = document.querySelector("#pill" + t.dataset.s + " span"); if (pill) pill.textContent = fmtDur(s.secs);
    }
  }
});
$app.addEventListener("keydown", (e) => {
  const t = e.target;
  if (draft && e.key === "Enter" && t.dataset && t.dataset.s !== undefined && t.dataset.k === "name") {
    e.preventDefault(); const i = +t.dataset.s;
    draft.steps.splice(i + 1, 0, {id: uid(), name: "", secs: 0}); draft.open = -1; pendingFocus = "s" + (i + 1); render();
  }
});
$app.addEventListener("change", (e) => {
  if (e.target.id !== "importFile" || !e.target.files || !e.target.files[0]) return;
  const f = e.target.files[0], rd = new FileReader();
  rd.onload = () => importText(String(rd.result)); rd.onerror = () => toast("Couldn't read that file."); rd.readAsText(f);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet) closeSheet(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && run && view === "run") { requestWake(); updateTimer(); }
});
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; if (view === "home" && !sheet) render(); });
window.addEventListener("appinstalled", () => { deferredPrompt = null; if (!sheet) render(); });
if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyPalette(); syncThemeColor(); });

/* ================= boot ================= */
applyTheme();
loadSavedRun();
render();
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
})();
