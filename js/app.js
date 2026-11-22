(() => {
"use strict";

/* ================= constants ================= */
const KEY = "routines-app-v2";
const RUNKEY = "routines-run-v2";
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const DAYFULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const PRESETS = [15,30,60,120,180,300,600,900,1200,1800];
const MINPRESETS = [5,10,15,30,60,120,180,300,600,900,1200];
/* A template step is [name, seconds, note, [checklist items], shortest seconds] */
const TEMPLATES = [
  {name:"Morning start", days:[1,2,3,4,5], steps:[["Drink a glass of water",60,"Before coffee",[],5],["Stretch",300,"",["Neck","Shoulders","Hamstrings"],120],["Plan the day",300,"",[],60]]},
  {name:"Evening wind-down", days:[], steps:[["Tidy up",300,"",["Dishes","Desk","Laundry"],60],["Pack tomorrow's bag",180,"",[],60],["Read",900,"",[],300]]},
  {name:"Workout", days:[], steps:[["Warm up",300,"",[],120],["Main set",1500,"",[],600],["Cool down",300,"",[],120]]},
  {name:"Focus block", days:[], steps:[["Clear your desk",120,"",[],30],["Deep work",1500,"",[],900],["Break",300,"",[],60]]}
];

/* ================= small helpers ================= */
const $app = document.getElementById("app");
const uid = () => Math.random().toString(36).slice(2, 9);
const mkStep = ([name, secs, note, items, min]) => ({id: uid(), name, secs, note: note || "", minSecs: min || 0, items: (items || []).map((text) => ({id: uid(), text}))});
const blankStep = () => mkStep(["", 60]);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic = (n, c = "") => `<svg class="i ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const dayKey = (ts) => { const d = new Date(ts); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
const startOfDay = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const fmt = (sec) => { sec = Math.max(0, sec); const m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; };
const clock = (ts) => new Date(ts).toLocaleTimeString(undefined, {hour: "numeric", minute: "2-digit"});
function fmtDur(sec) {
  if (!sec) return "0 sec";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h ? h + " h" : "", m ? m + " min" : "", s ? s + " sec" : ""].filter(Boolean).join(" ");
}
const presetLabel = (p) => p < 60 ? p + " sec" : p % 60 ? Math.floor(p / 60) + " min " + (p % 60) + " sec" : (p / 60) + " min";
const isStandalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/* ================= state ================= */
function seed() {
  return normalize({
    v: 2, updatedAt: 0, log: [],
    routines: TEMPLATES.slice(0, 2).map((t) => ({id: uid(), name: t.name, days: t.days, steps: t.steps.map(mkStep)}))
  });
}
/* Accepts older backups too (they carried colors, which are no longer used). */
/* Every step has a time: nothing below 5 seconds, and older untimed steps become 1 minute. */
const stepSecs = (v) => { v = Math.round(+v || 0); return v <= 0 ? 60 : Math.max(5, v); };
function normalize(o) {
  if (!o || typeof o !== "object" || !Array.isArray(o.routines)) return null;
  const st = (o.settings || {});
  const s = {
    v: 2, updatedAt: +o.updatedAt || 0, routines: [], log: [],
    settings: {sound: st.sound !== false, vibrate: st.vibrate !== false, auto: !!st.auto, wake: st.wake !== false, theme: ["light","dark","system"].includes(st.theme) ? st.theme : "light", hideInstall: !!st.hideInstall}
  };
  o.routines.forEach((r) => {
    if (!r || !Array.isArray(r.steps)) return;
    const steps = r.steps.map((t) => ({
      id: String(t.id || uid()), name: String(t.name || "").slice(0, 80), secs: stepSecs(t.secs),
      minSecs: 0,
      note: String(t.note || "").slice(0, 500),
      items: (Array.isArray(t.items) ? t.items : []).map((x) => ({id: String((x && x.id) || uid()), text: String((x && x.text) || "").slice(0, 80)})).filter((x) => x.text).slice(0, 30)
    })).filter((t) => t.name);
    steps.forEach((t, i) => { const m = Math.round(+r.steps[i].minSecs || 0); t.minSecs = m > 0 ? Math.min(t.secs, Math.max(5, m)) : 0; });
    s.routines.push({
      id: String(r.id || uid()), name: String(r.name || "Untitled routine").slice(0, 60),
      days: (Array.isArray(r.days) ? r.days : []).filter((d) => d >= 0 && d <= 6), steps
    });
  });
  if (Array.isArray(o.log)) o.log.forEach((l) => {
    if (l && l.at) s.log.push({id: String(l.id || uid()), rid: String(l.rid || ""), name: String(l.name || ""), at: +l.at, secs: +l.secs || 0, done: +l.done || 0, total: +l.total || 0});
  });
  s.log.sort((a, b) => b.at - a.at);
  s.fit = cleanFit(o.fit);
  return s;
}
/* Remembered "fit to time" adjustments: {routineId: {last: minutes, b: {minutes: {at, steps: {stepId: {secs, skip, off:[itemIds]}}}}}} */
function cleanFit(f) {
  const out = {};
  if (!f || typeof f !== "object") return out;
  Object.keys(f).forEach((rid) => {
    const e = f[rid]; if (!e || typeof e !== "object" || !e.b || typeof e.b !== "object") return;
    const b = {};
    Object.keys(e.b).forEach((k) => {
      const m = +k, v = e.b[k]; if (!(m > 0) || !v || typeof v.steps !== "object" || !v.steps) return;
      const steps = {};
      Object.keys(v.steps).forEach((id) => { const x = v.steps[id] || {}; steps[id] = {secs: Math.max(5, Math.round(+x.secs || 0)), skip: !!x.skip, off: (Array.isArray(x.off) ? x.off : []).map(String)}; });
      b[m] = {at: +v.at || 0, steps};
    });
    if (Object.keys(b).length) out[rid] = {last: +e.last > 0 ? +e.last : 0, b};
  });
  return out;
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const n = normalize(JSON.parse(raw)); if (n) return n; } } catch (e) {}
  return seed();
}
let state = load();
let sync = null;  /* GitHub sync connection, set up at boot */
function save() {
  state.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  if (sync && syncCore() !== sync.last) { sync.dirty = true; saveSync(); schedulePush(); }
}
try { if (!localStorage.getItem(KEY)) save(); } catch (e) {}  /* keep the first-run example routines (and their ids) stable */

let view = "home", lastView = "", sheet = null, sheetFresh = false, detailId = null;
let draft = null, run = null, savedRun = null, timer = null, wake = null, audioCtx = null, deferredPrompt = null;
let pendingFocus = null, confirmKey = null, fit = null;

/* ================= selectors ================= */
const routineById = (id) => state.routines.find((r) => r.id === id);
const total = (r) => r.steps.reduce((a, s) => a + s.secs, 0);
function doneToday() { const k = dayKey(Date.now()), m = {}; state.log.forEach((l) => { if (dayKey(l.at) === k) m[l.rid] = 1; }); return m; }
function daysLabel(r) {
  const d = r.days.slice().sort().join("");
  if (!d) return "";
  if (d === "0123456") return "every day";
  if (d === "12345") return "weekdays";
  if (d === "06") return "weekends";
  return r.days.slice().sort().map((x) => DAYFULL[x].slice(0, 3)).join(", ");
}
const metaLine = (r, withDays = true) => [r.steps.length + (r.steps.length === 1 ? " step" : " steps"), total(r) ? fmtDur(total(r)) : "", withDays ? daysLabel(r) : ""].filter(Boolean).join(", ");
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
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.settings.theme);
  syncThemeColor();
}
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", getComputedStyle(document.body).backgroundColor);
}

/* ================= views ================= */
function cardHtml(r, dt) {
  const done = dt[r.id], tot = total(r);
  const meta = done ? `${ic("check", "sm")}<span>Done today${tot ? ", " + fmtDur(tot) : ""}</span>` : `<span>${esc(metaLine(r))}</span>`;
  return `<div class="card"><button class="main" data-a="open" data-id="${esc(r.id)}"><h3>${esc(r.name)}</h3><p class="meta">${meta}</p></button>
    <button class="circle${done ? " yel" : ""}" data-a="start" data-id="${esc(r.id)}" aria-label="${done ? "Run " + esc(r.name) + " again" : "Start " + esc(r.name)}">${ic(done ? "check" : "play", "lg")}</button></div>`;
}
function resumeHtml(r) {
  const n = savedRun.res.filter(Boolean).length;
  return `<div class="card resume"><div class="main"><h3>${esc(r.name)}</h3><p class="meta">In progress, ${n} of ${r.steps.length} done</p><button class="more" data-a="discardRun">Discard</button></div>
    <button class="circle yel" data-a="resume" aria-label="Resume ${esc(r.name)}">${ic("play", "lg")}</button></div>`;
}
function homeHtml() {
  const dt = doneToday(), t = new Date().getDay();
  const rank = (r) => dt[r.id] ? 2 : (r.days.includes(t) ? 0 : 1);
  const list = state.routines.slice().sort((a, b) => rank(a) - rank(b));
  const sr = savedRun && routineById(savedRun.rid);
  const rows = (sr ? resumeHtml(sr) : "") + list.filter((r) => !sr || r.id !== sr.id).map((r) => cardHtml(r, dt)).join("");
  const now = new Date();
  const wd = now.toLocaleDateString(undefined, {weekday: "long"}), date = now.toLocaleDateString(undefined, {day: "numeric", month: "long"});
  let note = "";
  if (!isStandalone() && !state.settings.hideInstall) {
    const how = deferredPrompt ? `<button class="btn primary sm" data-a="install" style="margin-top:8px">Install</button>` : isIOS() ? "In Safari, tap Share, then Add to Home Screen." : "Open the browser menu and choose Install app or Add to Home screen.";
    note = `<div class="note"><div><b>Add Routines to your home screen</b><span class="muted">It opens full screen and works offline. </span>${deferredPrompt ? how : `<span class="muted">${how}</span>`}</div><button class="x" data-a="hideInstall" aria-label="Dismiss">${ic("x", "sm")}</button></div>`;
  }
  return `<header class="top"><div><h1 class="title">${esc(wd)}</h1><p class="sub">${esc(date)}</p></div>
    <button class="round" data-a="settings" aria-label="Settings">${ic("sliders")}</button></header>
    <main class="pad"><h2 class="h2">Routines</h2>
    ${rows ? `<div class="rows">${rows}</div>` : `<p class="empty">No routines yet. Tap the yellow button to start from a template or build your own.</p>`}
    ${note}</main>
    <div class="fabwrap"><button class="fab" data-a="new" aria-label="New routine">${ic("plus", "lg")}</button></div>`;
}

const etaText = (secs) => "About " + fmtDur(secs) + ", done by " + clock(Date.now() + secs * 1000);
function subHtml(s) {
  if (!s.note && !s.items.length) return "";
  return `<div class="ssub">${s.note ? `<p class="snote">${esc(s.note)}</p>` : ""}${s.items.map((x) => `<div class="si"><i></i><span>${esc(x.text)}</span></div>`).join("")}</div>`;
}
function detailHtml() {
  const r = routineById(detailId);
  if (!r) { view = "home"; return homeHtml(); }
  const runs = state.log.filter((l) => l.rid === r.id), tot = total(r);
  return `<div class="bar"><button class="round" data-a="tab" data-t="home" aria-label="Back to routines">${ic("back")}</button>
    <button class="round" data-a="edit" data-id="${esc(r.id)}" aria-label="Edit routine">${ic("edit", "sm")}</button></div>
    <div class="dhead"><h1>${esc(r.name)}</h1><p class="sub">${esc(metaLine(r))}</p>
    <button class="fitbtn" data-a="fitOpen" data-id="${esc(r.id)}">${ic("shrink", "sm")}Fit to time</button>
    <p class="muted">${runs.length ? "Done " + runs.length + (runs.length === 1 ? " time" : " times") + ", last " + relDay(runs[0].at).toLowerCase() : "Not done yet"}</p></div>
    <ol class="ol" style="padding-bottom:130px">${r.steps.map((s, i) => `<li><div class="r"><span class="n">${i + 1}</span><span class="nm">${esc(s.name)}</span><span class="du">${fmtDur(s.secs)}</span></div>${subHtml(s)}</li>`).join("")}</ol>
    <div class="dock"><div class="in"><button class="startbtn" data-a="start" data-id="${esc(r.id)}">${ic("play", "lg")}<span class="t"><b>Start</b><span data-eta="${tot}">${etaText(tot)}</span></span></button>
    <button class="circle" data-a="addTo" data-id="${esc(r.id)}" aria-label="Add a step">${ic("plus", "lg")}</button></div></div>`;
}


/* ================= fit to time ================= */
const gridFor = (base) => base <= 120 ? 5 : base <= 600 ? 15 : 60;
const floorTo = (x, g) => Math.floor(x / g) * g;
function itemRatio(s, off) {
  const n = s.items.length; if (!n) return 1;
  return (n - s.items.filter((x) => off[x.id]).length) / n;
}
/* Build the starting plan for a routine and a time budget (minutes). Uses what you chose last time you had a similar amount of time. */
function fitPlan(r, Bmin) {
  const B = Bmin * 60, rec = (state.fit[r.id] || {}).b || {}, keys = Object.keys(rec).map(Number);
  const key = keys.length ? keys.reduce((a, b) => Math.abs(b - Bmin) < Math.abs(a - Bmin) ? b : a) : null;
  const mem = key != null ? rec[key].steps : {}, exact = key === Bmin;
  const plan = r.steps.map((s, i) => {
    const m = mem[s.id] || {}, off = {};
    (m.off || []).forEach((id) => { if (s.items.some((x) => x.id === id)) off[id] = true; });
    return {i, secs: m.secs ? Math.min(s.secs, Math.max(5, m.secs)) : s.secs, skip: !!m.skip, off, open: false};
  });
  const live = plan.filter((p) => !p.skip), sum = () => live.reduce((a, p) => a + p.secs, 0);
  if (sum() > B) {
    const s0 = live.map((p) => p.secs), fl = live.map((p) => { const s = r.steps[p.i]; return s.minSecs ? Math.min(s.minSecs, p.secs) : p.secs; });
    const tot = (f) => live.reduce((a, p, k) => a + Math.max(fl[k], f * s0[k]), 0);
    let f = 0;
    if (tot(0) <= B) { let lo = 0, hi = 1; for (let n = 0; n < 40; n++) { const mid = (lo + hi) / 2; if (tot(mid) <= B) lo = mid; else hi = mid; } f = lo; }
    live.forEach((p, k) => { p.secs = Math.max(fl[k], Math.min(s0[k], floorTo(f * s0[k], gridFor(r.steps[p.i].secs)))); });
  } else if (!exact && sum() < B) {
    const s0 = live.map((p) => p.secs), cap = live.map((p) => Math.max(p.secs, r.steps[p.i].secs * itemRatio(r.steps[p.i], p.off)));
    const tot = (g) => live.reduce((a, p, k) => a + Math.min(cap[k], g * s0[k]), 0);
    let lo = 1, hi = 1000; for (let n = 0; n < 40; n++) { const mid = (lo + hi) / 2; if (tot(mid) <= B) lo = mid; else hi = mid; }
    live.forEach((p, k) => { p.secs = Math.max(s0[k], Math.min(cap[k], floorTo(lo * s0[k], gridFor(r.steps[p.i].secs)))); });
  }
  return plan;
}
const fitTotal = () => fit.plan.reduce((a, p) => a + (p.skip ? 0 : p.secs), 0);
function fitStatus() {
  const tot = fitTotal(), diff = fit.B * 60 - tot, by = "Done by " + clock(Date.now() + tot * 1000);
  const rd = (x) => fmtDur(Math.max(5, Math.round(x / 5) * 5));
  if (diff < 0) return {over: true, line: rd(-diff) + " over", hint: "Skip a step or an item, or shorten a time.", by};
  return {over: false, line: diff < 30 ? "Fits" : "Fits, " + rd(diff) + " to spare", hint: "", by};
}
function fitGoHtml(st) {
  return `<b>${st.over ? "Start anyway" : "Start"}</b><span>${st.by}</span>`;
}
function fitRow(r, p) {
  const s = r.steps[p.i], g = gridFor(s.secs), n = s.items.length, left = s.items.filter((x) => !p.off[x.id]).length;
  if (p.skip) return `<li class="frow skipped"><div class="fr1"><span class="nm">${esc(s.name)}</span><button class="fbtn" data-a="fskip" data-i="${p.i}">Add back</button></div></li>`;
  const max = Math.max(s.secs, g), pct = max > g ? Math.round(100 * (p.secs - g) / (max - g)) : 100;
  const items = p.open ? `<div class="fitems" role="group" aria-label="Items in ${esc(s.name)}"><p class="muted">Untick what you will skip. Time shrinks to match.</p>${s.items.map((x) => `<button class="ci" data-a="fitem" data-i="${p.i}" data-id="${esc(x.id)}" aria-pressed="${!p.off[x.id]}"><span class="box">${ic("check", "sm")}</span><span class="t">${esc(x.text)}</span></button>`).join("")}</div>` : "";
  return `<li class="frow"><div class="fr1"><span class="nm">${esc(s.name)}</span><span class="ft" id="fl${p.i}">${fmtDur(p.secs)}</span></div>
    <input class="rng" id="fs${p.i}" type="range" min="${g}" max="${max}" step="${g}" value="${Math.min(max, Math.max(g, p.secs))}" data-i="${p.i}" aria-label="Time for ${esc(s.name)}" style="--p:${pct}%">
    <div class="fr3"><span class="fsub">Was ${fmtDur(s.secs)}${s.minSecs ? ", shortest " + fmtDur(s.minSecs) : ""}</span><span class="facts">${n ? `<button class="fbtn" data-a="fopen" data-i="${p.i}" aria-expanded="${p.open}">Items ${left}/${n}</button>` : ""}<button class="fbtn" data-a="fskip" data-i="${p.i}">Skip</button></span></div>${items}</li>`;
}
function fitHtml() {
  const r = routineById(fit.rid); if (!r) { view = "home"; return homeHtml(); }
  const st = fitStatus(), B = fit.B;
  return `<div class="bar"><button class="round" data-a="fitBack" aria-label="Back to routine">${ic("back")}</button><h1 class="ftitle">Fit to time</h1><span class="round ghost" aria-hidden="true"></span></div>
    <div class="dhead" style="padding-bottom:8px"><p class="sub">${esc(r.name)}</p></div>
    <div class="bud"><p class="lbl" style="margin:0 0 8px 4px">How much time do you have?</p>
      <div class="bstep"><button class="round" data-a="fbud" data-d="-5" aria-label="5 minutes less">${ic("minus")}</button><p class="bnum"><b id="fitB">${B}</b> min</p><button class="round" data-a="fbud" data-d="5" aria-label="5 minutes more">${ic("plus")}</button></div>
      <div class="bchips">${[15, 30, 45, 60, 90].map((m) => `<button class="chip" data-a="fbud" data-v="${m}" aria-pressed="${B === m}">${m}</button>`).join("")}</div></div>
    <ol class="flist">${fit.plan.map((p) => fitRow(r, p)).join("")}</ol>
    <div class="dock"><div class="in col"><p class="fsum${st.over ? " over" : ""}" id="fitSum" role="status"><b>${st.line}</b> <span>${esc(st.hint)}</span></p>
      <button class="startbtn" id="fitGo" data-a="fitStart">${ic("play", "lg")}<span class="t">${fitGoHtml(st)}</span></button></div></div>`;
}
function fitLive(i) {
  const r = routineById(fit.rid), p = fit.plan[i], s = r.steps[p.i], g = gridFor(s.secs), max = Math.max(s.secs, g);
  const l = document.getElementById("fl" + i); if (l) l.textContent = fmtDur(p.secs);
  const rg = document.getElementById("fs" + i); if (rg) rg.style.setProperty("--p", (max > g ? Math.round(100 * (p.secs - g) / (max - g)) : 100) + "%");
  fitLiveSummary();
}
function fitLiveSummary() {
  const st = fitStatus(), sum = document.getElementById("fitSum"), go = document.getElementById("fitGo");
  if (sum) { sum.className = "fsum" + (st.over ? " over" : ""); sum.innerHTML = `<b>${st.line}</b> <span>${esc(st.hint)}</span>`; }
  if (go) go.querySelector(".t").innerHTML = fitGoHtml(st);
}
function fitSetBudget(B) {
  const r = routineById(fit.rid); fit.B = Math.max(5, Math.min(600, B)); fit.plan = fitPlan(r, fit.B); render();
}
function fitStart() {
  const r = routineById(fit.rid); if (!r) return;
  const steps = fit.plan.filter((p) => !p.skip).map((p) => {
    const s = r.steps[p.i];
    return {id: s.id, name: s.name, secs: Math.max(5, Math.round(p.secs)), minSecs: s.minSecs, note: s.note, items: s.items.filter((x) => !p.off[x.id]).map((x) => ({id: x.id, text: x.text}))};
  });
  if (!steps.length) { toast("Add at least one step back first."); return; }
  const e = state.fit[r.id] = state.fit[r.id] || {last: 0, b: {}};
  e.last = fit.B;
  const rec = {at: Date.now(), steps: {}};
  fit.plan.forEach((p) => { rec.steps[r.steps[p.i].id] = {secs: Math.round(p.secs), skip: p.skip, off: Object.keys(p.off).filter((k) => p.off[k])}; });
  e.b[fit.B] = rec;
  Object.keys(e.b).sort((a, b) => e.b[b].at - e.b[a].at).slice(12).forEach((k) => { delete e.b[k]; });
  save();
  beginRun({id: r.id, name: r.name, steps});
}

function progressHtml() {
  const now = Date.now(), week = state.log.filter((l) => l.at >= now - 7 * 864e5).length;
  const secs = state.log.reduce((a, l) => a + l.secs, 0);
  const spent = secs >= 3600 ? Math.floor(secs / 3600) + " h " + Math.round((secs % 3600) / 60) + " min" : Math.max(1, Math.round(secs / 60)) + " min";
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
    const f = groups[k][0], rel = relDay(f.at), label = rel !== "Today" && rel !== "Yesterday" ? new Date(f.at).toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"}) : rel;
    return `<h3 class="day-h">${esc(label)}</h3>` + groups[k].map((l) => `<div class="log"><div class="t"><b>${esc(l.name)}</b><small>${clock(l.at)}</small></div><div class="r">${l.done}/${l.total} steps<small>${fmt(l.secs)}</small></div></div>`).join("");
  }).join("");
  const s = streak();
  return `<header class="top"><div><h1 class="title">Progress</h1></div><button class="round" data-a="settings" aria-label="Settings">${ic("sliders")}</button></header>
    <main class="pad"><div class="panel-c streak-card"><span class="circle yel" style="width:52px;height:52px">${ic("flame", "lg")}</span><div><h2>${s ? s + (s === 1 ? " day" : " days") + " in a row" : "No streak yet"}</h2>
    <p class="muted">${state.log.length ? week + (week === 1 ? " run" : " runs") + " in the last 7 days. " + state.log.length + " in total, " + spent + " spent." : "Finish a routine to start one."}</p></div></div>
    <div class="panel-c"><h2>Last 5 weeks</h2><div class="heat" role="img" aria-label="Calendar of days with completed routines">${heat}</div><p class="legend">Darker squares are days with more routines.</p></div>
    ${body || `<p class="empty">Finish a routine and it shows up here.</p>`}</main>`;
}

function timerPanel(s, i) {
  const m = Math.floor(s.secs / 60), sec = s.secs % 60;
  return `<div class="presets" role="group" aria-label="Timer presets">${PRESETS.map((p) => `<button data-a="preset" data-i="${i}" data-v="${p}" aria-pressed="${s.secs === p}">${presetLabel(p)}</button>`).join("")}</div>
    <div class="custom">Custom <input class="num-in" type="number" inputmode="numeric" min="0" max="999" data-s="${i}" data-k="m" value="${m || ""}" placeholder="0" aria-label="Minutes">min
    <input class="num-in" type="number" inputmode="numeric" min="0" max="59" data-s="${i}" data-k="s" value="${sec || ""}" placeholder="0" aria-label="Seconds">sec</div>`;
}
function minPanel(s, i) {
  const m = Math.floor((s.minSecs || 0) / 60), sec = (s.minSecs || 0) % 60;
  const opts = MINPRESETS.filter((p) => p < s.secs);
  return `<p class="muted">The shortest this step can get when you use Fit to time. Leave it off to keep the step at full time.</p>
    <div class="presets" role="group" aria-label="Shortest time presets"><button data-a="minpreset" data-i="${i}" data-v="0" aria-pressed="${!s.minSecs}">Not set</button>${opts.map((p) => `<button data-a="minpreset" data-i="${i}" data-v="${p}" aria-pressed="${s.minSecs === p}">${presetLabel(p)}</button>`).join("")}</div>
    <div class="custom">Custom <input class="num-in" type="number" inputmode="numeric" min="0" max="999" data-s="${i}" data-k="mm" value="${m || ""}" placeholder="0" aria-label="Shortest minutes">min
    <input class="num-in" type="number" inputmode="numeric" min="0" max="59" data-s="${i}" data-k="ms" value="${sec || ""}" placeholder="0" aria-label="Shortest seconds">sec</div>`;
}
function stepPanel(s, i) {
  let body;
  if (draft.sec === "timer") body = timerPanel(s, i);
  else if (draft.sec === "min") body = minPanel(s, i);
  else if (draft.sec === "list") {
    body = `<div class="items">${s.items.map((it, j) => `<div class="irow"><input class="iin" id="it${i}_${j}" data-s="${i}" data-j="${j}" data-k="item" value="${esc(it.text)}" placeholder="Checklist item" maxlength="80" autocomplete="off" aria-label="Item ${j + 1}"><button class="rmi" data-a="rmItem" data-i="${i}" data-j="${j}" aria-label="Remove item ${j + 1}">${ic("x", "sm")}</button></div>`).join("")}</div>
      <button class="addi" data-a="addItem" data-i="${i}">${ic("plus", "sm")}Add item</button>`;
  } else body = `<textarea class="nin" id="nt${i}" data-s="${i}" data-k="note" rows="3" maxlength="500" placeholder="Add a note to show while this step runs" aria-label="Note">${esc(s.note)}</textarea>`;
  return `<div class="tpanel">${body}<div class="mv"><button class="mvb" data-a="up" data-i="${i}"${i === 0 ? " disabled" : ""}>${ic("up", "sm")}Move up</button><button class="mvb" data-a="down" data-i="${i}"${i === draft.steps.length - 1 ? " disabled" : ""}>${ic("down", "sm")}Move down</button></div></div>`;
}
function stepRow(s, i, n) {
  const open = draft.open === i, sec = open ? draft.sec : "", cnt = s.items.length;
  const pill = (k, icon, label, has) => `<button class="pill${has ? " has" : ""}"${k === "timer" ? ` id="pill${i}"` : k === "min" ? ` id="pillm${i}"` : ""} data-a="sec" data-i="${i}" data-k="${k}" aria-expanded="${sec === k}">${ic(icon, "sm")}<span>${label}</span></button>`;
  return `<li class="step"><div class="r1"><span class="num">${i + 1}</span>
    <input class="sin" id="s${i}" data-s="${i}" data-k="name" value="${esc(s.name)}" placeholder="Name this step" maxlength="80" autocomplete="off" aria-label="Step ${i + 1} name">
    <button class="xbtn" data-a="rm" data-i="${i}" aria-label="Remove step ${i + 1}">${ic("x", "sm")}</button></div>
    <div class="r2">${pill("timer", "clock", fmtDur(s.secs), false)}${pill("list", "list", cnt ? "Checklist " + cnt : "Checklist", cnt > 0)}${pill("note", "note", "Note", !!s.note.trim())}${pill("min", "shrink", s.minSecs ? "Shortest " + fmtDur(s.minSecs) : "Shortest", s.minSecs > 0)}</div>
    ${open ? stepPanel(s, i) : ""}</li>`;
}
function editHtml() {
  const d = draft;
  return `<div class="ed-top"><button class="round" data-a="cancel" aria-label="Close without saving">${ic("x")}</button><h1>${d.isNew ? "New routine" : "Edit routine"}</h1><button class="btn primary sm" data-a="save">Save</button></div>
    <main class="pad">
    ${d.isNew ? `<div><p class="lbl" style="margin-top:4px">Start from a template</p><div class="hscroll" style="margin-top:10px">${TEMPLATES.map((t, i) => `<button class="chip" data-a="tpl" data-i="${i}">${esc(t.name)}</button>`).join("")}</div></div>` : ""}
    <div><label class="sr" for="rname">Routine name</label><input class="name-in" id="rname" data-f="name" value="${esc(d.name)}" placeholder="Name your routine" maxlength="60" autocomplete="off"></div>
    <p class="lbl">Days<small>Optional. Scheduled routines are listed first on those days.</small></p>
    <div class="days">${DAYS.map((n, i) => `<button class="dchip" data-a="day" data-i="${i}" aria-pressed="${d.days.includes(i)}" aria-label="${DAYFULL[i]}">${n}</button>`).join("")}</div>
    <p class="lbl">Steps<small>Every step has a timer. Add a checklist, a note, or the shortest time it can shrink to.</small></p>
    <ol class="steps">${d.steps.map((s, i) => stepRow(s, i, d.steps.length)).join("")}</ol>
    <button class="add" data-a="addStep">${ic("plus", "sm")}Add step</button>
    ${d.err ? `<p class="err" role="alert">${esc(d.err)}</p>` : ""}
    ${d.isNew ? "" : `<div class="dz"><button class="btn" data-a="dup">${ic("copy", "sm")}Duplicate</button><button class="btn danger" data-a="del">${ic("trash", "sm")}${confirmKey === "del" ? "Tap to confirm" : "Delete"}</button></div>`}
    </main>`;
}

const RING = 2 * Math.PI * 138;
function runHtml() {
  const st = run.steps[run.idx], timed = st.secs > 0, last = run.idx === run.steps.length - 1;
  const items = st.items || [], ck = run.checks[st.id] || {}, hasList = items.length > 0, allOn = hasList && items.every((x) => ck[x.id]);
  const chk = hasList ? `<div class="chk" role="group" aria-label="Checklist">${items.map((x) => `<button class="ci" data-a="chk" data-id="${esc(x.id)}" aria-pressed="${!!ck[x.id]}"><span class="box">${ic("check", "sm")}</span><span class="t">${esc(x.text)}</span></button>`).join("")}</div>` : "";
  const note = st.note ? `<p class="rnote">${esc(st.note)}</p>` : "";
  const face = timed
    ? `<div class="face${hasList ? " sm" : ""}" id="ring"><svg class="ring" viewBox="0 0 300 300" aria-hidden="true"><circle class="trk" cx="150" cy="150" r="138"/><circle id="ringFg" class="arc" cx="150" cy="150" r="138" stroke-dasharray="0 ${RING}" transform="rotate(-90 150 150)" style="opacity:0"/><circle id="ringDot" class="head" cx="150" cy="12" r="9"/></svg>
       <div class="in"><span id="timeTxt" class="time" role="timer">0:00</span><span id="timeSub" class="tsub"></span><button class="plus" data-a="plus">+1 min</button></div></div>`
    : hasList ? "" : `<div class="face"><svg class="ring" viewBox="0 0 300 300" aria-hidden="true"><circle class="trk" cx="150" cy="150" r="138"/></svg><div class="notimer">${ic("check")}<span>No timer</span></div></div>`;
  return `<div class="run">
    <header class="rtop"><button class="round" data-a="endAsk" aria-label="End routine">${ic("x")}</button><span class="rname">${esc(run.name)}</span><span class="cnt">${run.idx + 1} of ${run.steps.length}</span></header>
    <main class="rbody${hasList ? " hl" : ""}"><h1 class="rstep">${esc(st.name)}</h1>${note}${face}${chk}
    <div class="ctl">${timed ? `<button class="cc" data-a="pause"><span class="c">${ic(run.paused ? "play" : "pause")}</span>${run.paused ? "Resume" : "Pause"}</button>` : `<span class="cc sp"></span>`}
    <button class="cc big${allOn && !timed ? " pulse" : ""}" id="doneBtn" data-a="done"><span class="c">${ic("check")}</span>${last ? "Finish" : "Done"}</button>
    <button class="cc" data-a="skip"><span class="c">${ic("next")}</span>Skip</button></div>
    <p class="next">${last ? "Last step" : "Next: " + esc(run.steps[run.idx + 1].name)}</p></main>
    <footer class="rfoot"><div class="acts">${run.idx > 0 ? `<button class="fbtn" data-a="back">${ic("back", "sm")}Previous step</button>` : ""}${last ? "" : `<button class="fbtn" data-a="later">Move to end${ic("end", "sm")}</button>`}</div><p id="finTxt"></p></footer></div>`;
}
function doneHtml() {
  const c = run.summary, s = streak();
  return `<div class="run"><div class="fin">
    <svg class="big" viewBox="0 0 100 100" aria-hidden="true"><circle class="disc2" cx="50" cy="50" r="46"/><path class="tick" d="M31 52l13 13 25-27"/></svg>
    <h1>Nicely done</h1><p class="lead">${esc(c.name)}</p>
    <div class="fstats"><div><b>${c.done}/${c.total}</b><span>Steps</span></div><div><b>${fmt(c.secs)}</b><span>Time</span></div>${s > 1 ? `<div><b>${s}</b><span>Day streak</span></div>` : ""}</div>
    <button class="btn primary block" style="max-width:300px;min-height:54px;font-size:16px" data-a="finish">Back to routines</button></div></div>`;
}

function sheetHtml() {
  const fresh = sheetFresh ? " enter" : "";
  if (sheet.type === "end") {
    return `<div class="scrim" data-a="closeSheet"><div class="panel${fresh}" role="dialog" aria-modal="true" aria-label="End routine"><div class="grab"></div>
      <h2>End this routine?</h2><p class="muted">Your progress on this run won't be saved.</p>
      <button class="btn primary block" data-a="closeSheet">Keep going</button><button class="btn danger block" data-a="endNow">End without saving</button></div></div>`;
  }
  const S = state.settings;
  const sw = (k, label, sub) => `<div class="set"><div><b>${label}</b><small>${sub}</small></div><button class="switch" role="switch" aria-checked="${S[k]}" aria-label="${label}" data-a="tg" data-k="${k}"></button></div>`;
  const themes = [["light", "Light"], ["dark", "Dark"], ["system", "Auto"]];
  return `<div class="scrim" data-a="closeSheet"><div class="panel${fresh}" role="dialog" aria-modal="true" aria-label="Settings"><div class="grab"></div>
    <div class="sh-head"><h2>Settings</h2><button class="round" data-a="closeSheet" aria-label="Close">${ic("x")}</button></div>
    <p class="lbl" style="margin-top:4px">Appearance</p>
    <div class="seg" role="group" aria-label="Theme">${themes.map(([t, l]) => `<button data-a="theme" data-v="${t}" aria-pressed="${S.theme === t}">${l}</button>`).join("")}</div>
    ${sw("sound", "Sound", "Beep when a timer ends")}${sw("vibrate", "Vibration", "Buzz when a timer ends (Android)")}${sw("auto", "Auto-advance", "Move on when a timer ends")}${sw("wake", "Keep screen on", "While a routine is running")}
    ${syncHtml()}
    <p class="lbl">Backup file<small>A copy you can keep anywhere. Sound and theme are not included in synced data.</small></p>
    <div class="grid2"><button class="btn" data-a="export">${ic("download", "sm")}Export</button><label class="btn" for="importFile" style="cursor:pointer">${ic("upload", "sm")}Import</label></div>
    <input type="file" id="importFile" accept="application/json,.json" class="sr">
    <details><summary>Copy or paste backup text</summary><div style="display:flex;flex-direction:column;gap:8px;padding-top:6px">
      <button class="btn" data-a="copy">${ic("copy", "sm")}Copy backup text</button>
      <textarea class="paste" id="pasteText" placeholder="Paste backup text here" aria-label="Backup text"></textarea>
      <button class="btn" data-a="restore">Restore from text</button></div></details>
    ${deferredPrompt && !isStandalone() ? `<button class="btn primary block" data-a="install">Install app</button>` : ""}
    <button class="btn danger block" data-a="clearHistory">${confirmKey === "clear" ? "Tap again to clear history" : "Clear history"}</button>
    <p class="muted" style="text-align:center">Routines 1.1</p></div></div>`;
}

function render() {
  const y = window.scrollY, pn = $app.querySelector(".panel"), py = pn ? pn.scrollTop : 0;
  let html = "", nav = false;
  if (view === "home") { html = homeHtml(); nav = view === "home"; }
  else if (view === "progress") { html = progressHtml(); nav = true; }
  else if (view === "detail") html = detailHtml();
  else if (view === "edit") html = editHtml();
  else if (view === "fit") html = fitHtml();
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
const openDetail = (id) => { detailId = id; go("detail"); };
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
    localStorage.setItem(RUNKEY, JSON.stringify({rid: run.rid, steps: run.steps.map((x) => ({id: x.id, name: x.name, secs: x.secs, minSecs: x.minSecs || 0, note: x.note || "", items: (x.items || []).map((y) => ({id: y.id, text: y.text}))})), idx: run.idx, res: run.res, startedAt: run.startedAt, checks: run.checks, paused: run.paused, remainMs: run.remainMs, endAt: run.endAt, totalMs: run.totalMs}));
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
  run = {rid: r.id, name: r.name, steps: r.steps.slice(), res: [], checks: {}, startedAt: Date.now(), paused: false, fired: false, remainMs: 0, endAt: 0, totalMs: 0};
  if (resume) {
    if (Array.isArray(resume.steps) && resume.steps.length) run.steps = resume.steps.filter((x) => x && x.name).map((x) => ({id: String(x.id || uid()), name: String(x.name), secs: stepSecs(x.secs), minSecs: x.minSecs || 0, note: String(x.note || ""), items: Array.isArray(x.items) ? x.items : []}));
    else if (Array.isArray(resume.order)) { const by = {}; run.steps.forEach((x) => { by[x.id] = x; }); const ord = resume.order.map((id) => by[id]).filter(Boolean); run.steps.forEach((x) => { if (!ord.includes(x)) ord.push(x); }); if (ord.length) run.steps = ord; }
    run.res = resume.res.slice(0, run.steps.length); run.startedAt = resume.startedAt; run.checks = resume.checks || {};
    const i = Math.max(0, Math.min(resume.idx, run.steps.length - 1));
    if (run.steps[i].secs > 0 && resume.totalMs > 0) { run.idx = i; run.totalMs = resume.totalMs; run.paused = !!resume.paused; run.remainMs = resume.remainMs; run.endAt = resume.endAt; persistRun(); }
    else startStep(i);
  } else startStep(0);
  savedRun = null; sheet = null; confirmKey = null; view = "run"; render();
  requestWake();
  clearInterval(timer); timer = setInterval(updateTimer, 250);
}
function finishLine() {
  let ms = 0;
  for (let i = run.idx + 1; i < run.steps.length; i++) ms += run.steps[i].secs * 1000;
  if (run.steps[run.idx].secs > 0) ms += remaining();
  return ms > 0 ? "Routine finishes around " + clock(Date.now() + ms) : "";
}
function updateTimer() {
  if (!run || view !== "run") return;
  const fin = document.getElementById("finTxt"); if (fin) fin.textContent = finishLine();
  const st = run.steps[run.idx]; if (!(st.secs > 0)) return;
  const rem = remaining(), txt = document.getElementById("timeTxt"), fg = document.getElementById("ringFg"), dot = document.getElementById("ringDot"), sub = document.getElementById("timeSub"), ring = document.getElementById("ring");
  const frac = Math.min(1, Math.max(0, 1 - rem / run.totalMs));
  if (txt) txt.textContent = fmt(Math.ceil(rem / 1000));
  if (fg) { fg.setAttribute("stroke-dasharray", (RING * frac).toFixed(1) + " " + RING.toFixed(1)); fg.style.opacity = frac > 0.004 ? "1" : "0"; }
  if (dot) dot.setAttribute("transform", "rotate(" + (frac * 360).toFixed(2) + " 150 150)");
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
  state.log.unshift({id: uid(), rid: run.rid, name: run.name, at: Date.now(), secs, done, total: tot});
  if (state.log.length > 1000) state.log.length = 1000;
  save();
  run.summary = {name: run.name, done, total: tot, secs};
  vib([60, 40, 60]);
  view = "done"; persistRun(); render();
}

/* ================= editor ================= */
function openEditor(id, from) {
  const r = id ? routineById(id) : null;
  draft = r
    ? {id: r.id, isNew: false, from: from || "home", name: r.name, days: r.days.slice(), open: -1, sec: "timer", err: "", steps: r.steps.map((s) => ({id: s.id, name: s.name, secs: s.secs, note: s.note || "", minSecs: s.minSecs || 0, items: (s.items || []).map((x) => ({id: x.id, text: x.text}))}))}
    : {id: uid(), isNew: true, from: "home", name: "", days: [], open: -1, sec: "timer", err: "", steps: [blankStep()]};
  sheet = null; confirmKey = null; view = "edit";
  if (!r) pendingFocus = "rname";
  render();
}
function commitDraft() {
  const d = draft;
  const steps = d.steps.map((s) => { const secs = stepSecs(s.secs), m = Math.round(+s.minSecs || 0); return {id: s.id, name: s.name.trim(), secs, minSecs: m > 0 ? Math.min(secs, Math.max(5, m)) : 0, note: (s.note || "").trim(), items: s.items.map((x) => ({id: x.id, text: x.text.trim()})).filter((x) => x.text)}; }).filter((s) => s.name);
  if (!steps.length) return null;
  return {id: d.id, name: d.name.trim() || "Untitled routine", days: d.days.slice().sort(), steps};
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

/* ================= sync (GitHub) =================
   Your routines, history and Fit-to-time memory are kept in data.json in a private repo you own.
   The phone keeps a full local copy, so the app works offline and pushes when it can. */
const SYNCKEY = "routines-sync-v1", SYNCFILE = "data.json";
let pushT = 0, connMsg = "", connDraft = {repo: "", token: ""};
const syncCore = () => JSON.stringify({routines: state.routines, log: state.log, fit: state.fit});
function loadSync() {
  try {
    const o = JSON.parse(localStorage.getItem(SYNCKEY) || "null");
    if (o && o.token && /^[\w.-]+\/[\w.-]+$/.test(o.repo || "")) return {token: o.token, repo: o.repo, sha: o.sha || "", dirty: !!o.dirty, at: +o.at || 0, pub: !!o.pub, err: "", busy: false, tried: 0, last: ""};
  } catch (e) {}
  return null;
}
function saveSync() {
  try {
    if (sync) localStorage.setItem(SYNCKEY, JSON.stringify({token: sync.token, repo: sync.repo, sha: sync.sha, dirty: sync.dirty, at: sync.at, pub: sync.pub}));
    else localStorage.removeItem(SYNCKEY);
  } catch (e) {}
}
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
const defaultRepo = () => { const m = /^([\w-]+)\.github\.io$/i.exec(location.hostname); return (m ? m[1] : "your-name") + "/routines-data"; };
const b64e = (s) => { const b = new TextEncoder().encode(s); let t = ""; for (let i = 0; i < b.length; i += 8192) t += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(t); };
const b64d = (s) => { const t = atob(s.replace(/\s/g, "")); return new TextDecoder().decode(Uint8Array.from(t, (c) => c.charCodeAt(0))); };
const ghHeaders = (extra) => Object.assign({Authorization: "Bearer " + sync.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}, extra || {});
const ghErr = (status, msg) => { const e = new Error(msg || "GitHub error " + status); e.status = status; return e; };
async function ghGet() {
  const base = "https://api.github.com/repos/" + sync.repo;
  let res = await fetch(base + "/contents/" + SYNCFILE, {headers: ghHeaders(), cache: "no-store"});
  if (res.status === 404) {
    const rp = await fetch(base, {headers: ghHeaders(), cache: "no-store"});
    if (!rp.ok) throw ghErr(rp.status);
    sync.pub = !(await rp.json()).private;
    return {sha: "", data: null};
  }
  if (!res.ok) throw ghErr(res.status);
  const j = await res.json();
  let text;
  if (j.encoding === "base64" && j.content) text = b64d(j.content);
  else {
    const raw = await fetch(base + "/contents/" + SYNCFILE, {headers: ghHeaders({Accept: "application/vnd.github.raw+json"}), cache: "no-store"});
    if (!raw.ok) throw ghErr(raw.status); text = await raw.text();
  }
  let data = null; try { data = JSON.parse(text); } catch (e) {}
  if (!data || !Array.isArray(data.routines)) throw ghErr(0, "data.json in that repo isn't a Routines file.");
  return {sha: j.sha, data};
}
async function ghPut(sha, body) {
  const res = await fetch("https://api.github.com/repos/" + sync.repo + "/contents/" + SYNCFILE, {
    method: "PUT", headers: ghHeaders({"Content-Type": "application/json"}), cache: "no-store",
    body: JSON.stringify({message: "Update routines " + new Date().toISOString().slice(0, 16).replace("T", " "), content: b64e(body), sha: sha || undefined})
  });
  if (res.status === 409 || res.status === 422) return {conflict: true};
  if (!res.ok) throw ghErr(res.status);
  return {sha: (await res.json()).content.sha};
}
function syncPayload() { return JSON.stringify({v: 2, updatedAt: state.updatedAt, routines: state.routines, log: state.log, fit: state.fit}, null, 1); }
function adopt(d) {
  const n = normalize(Object.assign({}, d, {settings: state.settings}));
  if (!n) throw ghErr(0, "data.json in that repo isn't a Routines file.");
  state = n; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  sync.last = syncCore(); sync.dirty = false;
}
/* Both sides changed: the newer copy wins for routines and Fit memory; history entries from both are kept. */
function mergeIn(d) {
  const n = normalize(Object.assign({}, d, {settings: state.settings}));
  if (!n) throw ghErr(0, "data.json in that repo isn't a Routines file.");
  const mine = new Set(state.log.map((l) => l.id)), theirs = new Set(n.log.map((l) => l.id));
  const log = state.log.concat(n.log.filter((l) => !mine.has(l.id))).sort((a, b) => b.at - a.at);
  if (n.updatedAt > state.updatedAt) { n.log = log; state = n; } else { state.log = log; }
  void theirs;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}
function syncUi() { if (sheet && sheet.type === "settings" && sync) render(); }
function schedulePush() { clearTimeout(pushT); pushT = setTimeout(() => syncNow(), 2500); }
function syncMsg(e) {
  if (e && e.status === 401) return "GitHub didn't accept that token. Check you copied all of it and that it hasn't expired.";
  if (e && e.status === 403) return "That token isn't allowed to change this repo. It needs the Contents permission set to Read and write.";
  if (e && e.status === 404) return "Can't find that repo. Check the name, and that the token includes it.";
  if (e && e.status === 0) return e.message;
  return "Can't reach GitHub right now. Your changes are kept and will be sent later.";
}
async function syncNow(o) {
  o = o || {};
  if (!sync || sync.busy) return;
  if (!o.manual && !o.first && run && view === "run" && !sync.dirty) return;
  sync.busy = true; sync.err = ""; sync.tried = Date.now(); syncUi();
  let fatal = false;
  try {
    for (let n = 0; n < 3; n++) {
      const rem = await ghGet();
      if (rem.data && (o.first || rem.sha !== sync.sha)) {
        if (o.first || !sync.dirty) adopt(rem.data); else { mergeIn(rem.data); sync.dirty = true; }
        sync.sha = rem.sha; o.first = false;
        if (!(run && view === "run")) render();
      }
      if (sync.dirty || !rem.data) {
        const sent = syncCore(), res = await ghPut(rem.sha, syncPayload());
        if (res.conflict) continue;
        sync.sha = res.sha; sync.last = sent; sync.dirty = syncCore() !== sent;
      }
      sync.at = Date.now(); break;
    }
  } catch (e) {
    sync.err = syncMsg(e); fatal = !!e && [0, 401, 403, 404].includes(e.status);
  }
  sync.busy = false;
  if (o.firstTry && fatal) { connMsg = sync.err; sync = null; saveSync(); render(); return; }
  saveSync(); syncUi();
  if (sync.dirty && !sync.err) schedulePush();
}
function syncConnect() {
  const repo = ((document.getElementById("syncRepo") || {}).value || "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/, "").replace(/\/$/, "");
  const token = ((document.getElementById("syncToken") || {}).value || "").trim();
  connDraft = {repo, token}; connMsg = "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { connMsg = "Enter the repo as owner/name, for example " + defaultRepo() + "."; render(); return; }
  if (token.length < 20) { connMsg = "Paste the token you made on GitHub."; render(); return; }
  sync = {token, repo, sha: "", dirty: false, at: 0, pub: false, err: "", busy: false, tried: 0, last: ""};
  saveSync();
  syncNow({first: true, firstTry: true, manual: true});
}
function syncDisconnect() { clearTimeout(pushT); sync = null; saveSync(); connDraft = {repo: "", token: ""}; connMsg = ""; render(); toast("Sync turned off. Your routines stay on this phone."); }
function syncHtml() {
  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  if (sync) {
    const st = sync.busy ? "Syncing…" : sync.err ? sync.err : sync.dirty ? "Waiting to send your latest changes." : "Up to date, " + ago(sync.at);
    return `<p class="lbl">GitHub sync<small>${esc(sync.repo)}</small></p>
      <p class="syncst${sync.err ? " bad" : ""}" role="status">${esc(st)}</p>
      ${sync.pub ? `<p class="syncst bad">This repo is public, so anyone can read your routines. Make it private in the repo's settings.</p>` : ""}
      <div class="grid2"><button class="btn" data-a="syncNow"${sync.busy ? " disabled" : ""}>Sync now</button><button class="btn" data-a="syncOff">Turn off</button></div>`;
  }
  return `<p class="lbl">GitHub sync<small>Keeps your routines in your own private repo, so a lost or new phone loses nothing.</small></p>
    <input class="fld" id="syncRepo" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Data repo" placeholder="${esc(defaultRepo())}" value="${esc(connDraft.repo)}">
    <input class="fld" id="syncToken" type="password" autocomplete="off" autocapitalize="off" aria-label="GitHub token" placeholder="Paste your token" value="${esc(connDraft.token)}">
    ${connMsg ? `<p class="syncst bad" role="alert">${esc(connMsg)}</p>` : ""}
    <button class="btn primary block" data-a="syncConnect">Connect</button>
    <details><summary>How to get a token</summary><ol class="how">
      <li>On github.com open <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens</b>, then <b>Generate new token</b>.</li>
      <li>Under <b>Repository access</b> choose <b>Only select repositories</b> and pick your private data repo.</li>
      <li>Under <b>Permissions → Repository permissions</b> set <b>Contents</b> to <b>Read and write</b>.</li>
      <li>Pick the longest expiry, generate, and paste the token above.</li></ol>
      <p class="muted">If this repo already has routines in it, connecting loads them and replaces what is on this phone.</p></details>`;
}

/* ================= actions ================= */
function act(a, ds) {
  if (!["del", "clearHistory"].includes(a)) confirmKey = null;
  const i = ds.i !== undefined ? +ds.i : null;
  switch (a) {
    case "tab": go(ds.t); break;
    case "new": openEditor(null); break;
    case "edit": openEditor(ds.id, "detail"); break;
    case "addTo": openEditor(ds.id, "detail"); draft.steps.push(blankStep()); pendingFocus = "s" + (draft.steps.length - 1); render(); break;
    case "open": openDetail(ds.id); break;
    case "fitOpen": { const r = routineById(ds.id); if (!r) break; const B = (state.fit[r.id] || {}).last || 60; fit = {rid: r.id, B, plan: fitPlan(r, B)}; go("fit"); break; }
    case "fitBack": openDetail(fit.rid); break;
    case "fbud": fitSetBudget(ds.d ? fit.B + (+ds.d) : +ds.v); break;
    case "fskip": fit.plan[i].skip = !fit.plan[i].skip; render(); break;
    case "fopen": fit.plan[i].open = !fit.plan[i].open; render(); break;
    case "fitem": {
      const r = routineById(fit.rid), p = fit.plan[i], st = r.steps[p.i], g = gridFor(st.secs), before = itemRatio(st, p.off);
      p.off[ds.id] = !p.off[ds.id]; const after = itemRatio(st, p.off);
      const next = before > 0 ? p.secs * after / before : st.secs * after;
      p.secs = Math.max(g, Math.min(st.secs, floorTo(next, g)));
      render(); break;
    }
    case "fitStart": fitStart(); break;
    case "start": { const r = routineById(ds.id); if (r && r.steps.length) beginRun(r); break; }
    case "resume": { const r = savedRun && routineById(savedRun.rid); if (r) beginRun(r, savedRun); break; }
    case "discardRun": savedRun = null; persistRunClear(); render(); break;
    case "settings": openSheet({type: "settings"}); break;
    case "closeSheet": closeSheet(); break;
    case "hideInstall": state.settings.hideInstall = true; save(); render(); break;
    case "install": if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.finally(() => { deferredPrompt = null; render(); }); } break;
    case "tg": state.settings[ds.k] = !state.settings[ds.k]; save(); render(); break;
    case "theme": state.settings.theme = ds.v; save(); applyTheme(); render(); break;
    case "syncConnect": syncConnect(); break;
    case "syncNow": syncNow({manual: true}); break;
    case "syncOff": syncDisconnect(); break;
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
    case "cancel": { const back = draft.from, id = draft.id; draft = null; if (back === "detail" && routineById(id)) openDetail(id); else go("home"); break; }
    case "day": { const k = draft.days.indexOf(i); if (k >= 0) draft.days.splice(k, 1); else draft.days.push(i); render(); break; }
    case "tpl": {
      const t = TEMPLATES[i];
      draft.name = t.name; draft.days = t.days.slice(); draft.open = -1;
      draft.steps = t.steps.map(mkStep); render(); break;
    }
    case "addStep": draft.steps.push(blankStep()); draft.open = -1; pendingFocus = "s" + (draft.steps.length - 1); render(); break;
    case "rm": draft.steps.splice(i, 1); if (!draft.steps.length) draft.steps.push(blankStep()); draft.open = -1; render(); break;
    case "up": if (i > 0) { [draft.steps[i - 1], draft.steps[i]] = [draft.steps[i], draft.steps[i - 1]]; if (draft.open === i) draft.open = i - 1; } render(); break;
    case "down": if (i < draft.steps.length - 1) { [draft.steps[i + 1], draft.steps[i]] = [draft.steps[i], draft.steps[i + 1]]; if (draft.open === i) draft.open = i + 1; } render(); break;
    case "sec": if (draft.open === i && draft.sec === ds.k) draft.open = -1; else { draft.open = i; draft.sec = ds.k; if (ds.k === "list" && !draft.steps[i].items.length) { draft.steps[i].items.push({id: uid(), text: ""}); pendingFocus = "it" + i + "_0"; } else if (ds.k === "note") pendingFocus = "nt" + i; } render(); break;
    case "addItem": { const it = draft.steps[i].items; it.push({id: uid(), text: ""}); pendingFocus = "it" + i + "_" + (it.length - 1); render(); break; }
    case "rmItem": draft.steps[i].items.splice(+ds.j, 1); render(); break;
    case "preset": draft.steps[i].secs = +ds.v; render(); break;
    case "minpreset": draft.steps[i].minSecs = +ds.v; render(); break;
    case "save": {
      const r = commitDraft();
      if (!r) { draft.err = "Add at least one step with a name."; render(); break; }
      const wasNew = draft.isNew;
      upsert(r); save(); draft = null; toast("Routine saved");
      if (wasNew) go("home"); else openDetail(r.id);
      break;
    }
    case "dup": {
      const r = commitDraft(); if (!r) { draft.err = "Add at least one step with a name."; render(); break; }
      upsert(r);
      state.routines.push({id: uid(), name: r.name + " copy", days: r.days.slice(), steps: r.steps.map((s) => ({id: uid(), name: s.name, secs: s.secs, minSecs: s.minSecs, note: s.note, items: s.items.map((x) => ({id: uid(), text: x.text}))}))});
      save(); draft = null; go("home"); toast("Routine duplicated"); break;
    }
    case "del":
      if (confirmKey === "del") { state.routines = state.routines.filter((x) => x.id !== draft.id); save(); draft = null; detailId = null; go("home"); toast("Routine deleted"); }
      else { confirmKey = "del"; render(); }
      break;
    /* runner */
    case "chk": { const st = run.steps[run.idx], c = run.checks[st.id] = run.checks[st.id] || {}; c[ds.id] = !c[ds.id]; vib(10); persistRun(); render(); break; }
    case "done": vib(15); advance("done"); break;
    case "skip": advance("skip"); break;
    case "later": if (run.idx < run.steps.length - 1) { const [m] = run.steps.splice(run.idx, 1); run.steps.push(m); run.res.length = run.idx; startStep(run.idx); render(); toast("Moved \u201c" + m.name + "\u201d to the end"); } break;
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
  const t = e.target;
  if (t.classList && t.classList.contains("rng") && fit) { fit.plan[+t.dataset.i].secs = +t.value; fitLive(+t.dataset.i); return; }
  if (!draft) return;
  if (t.dataset.f === "name") draft.name = t.value;
  else if (t.dataset.s !== undefined) {
    const s = draft.steps[+t.dataset.s], k = t.dataset.k;
    if (k === "name") s.name = t.value;
    else if (k === "note") s.note = t.value;
    else if (k === "item") s.items[+t.dataset.j].text = t.value;
    else if (k === "mm" || k === "ms") {
      const cur = s.minSecs || 0, v = Math.max(0, parseInt(t.value, 10) || 0);
      s.minSecs = k === "mm" ? Math.min(999, v) * 60 + (cur % 60) : Math.floor(cur / 60) * 60 + Math.min(59, v);
      const pill = document.querySelector("#pillm" + t.dataset.s + " span"); if (pill) pill.textContent = s.minSecs ? "Shortest " + fmtDur(s.minSecs) : "Shortest";
    }
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
    draft.steps.splice(i + 1, 0, blankStep()); draft.open = -1; pendingFocus = "s" + (i + 1); render();
  } else if (draft && e.key === "Enter" && t.dataset && t.dataset.k === "item") {
    e.preventDefault(); const i = +t.dataset.s, j = +t.dataset.j;
    draft.steps[i].items.splice(j + 1, 0, {id: uid(), text: ""}); pendingFocus = "it" + i + "_" + (j + 1); render();
  }
});
$app.addEventListener("change", (e) => {
  if (e.target.id !== "importFile" || !e.target.files || !e.target.files[0]) return;
  const f = e.target.files[0], rd = new FileReader();
  rd.onload = () => importText(String(rd.result)); rd.onerror = () => toast("Couldn't read that file."); rd.readAsText(f);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet) closeSheet(); });
const refreshEta = () => document.querySelectorAll("[data-eta]").forEach((el) => { if (+el.dataset.eta > 0) el.textContent = etaText(+el.dataset.eta); });
setInterval(refreshEta, 15000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && sync && Date.now() - sync.tried > 30000) syncNow();
  if (document.visibilityState === "visible") { refreshEta(); if (run && view === "run") { requestWake(); updateTimer(); } }
});
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; if (view === "home" && !sheet) render(); });
window.addEventListener("appinstalled", () => { deferredPrompt = null; if (!sheet) render(); });
if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => syncThemeColor());

/* ================= boot ================= */
applyTheme();
loadSavedRun();
render();
window.addEventListener("online", () => { if (sync) syncNow(); });
sync = loadSync();
if (sync) { sync.last = sync.dirty ? "" : syncCore(); syncNow(); }
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
})();
