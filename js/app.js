/* =========================================================
   JapaneseTraining — แอปหลัก (Vanilla JS, ไม่ต้อง build)
   ========================================================= */
(() => {
"use strict";

/* ---------- Utilities ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return todayStr(d); };
const TOTAL_DAYS = LESSONS.length;

function toast(msg, ms = 2600) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), ms);
}

/* ---------- Storage (localStorage, ป้องกัน error) ---------- */
const KEY = "jt.v1";
const DEFAULT_STATE = { done: {}, blocks: {}, srs: {}, studyDates: [], settings: { rate: 0.85, romaji: true, autoSpeak: true, theme: "auto", voice: "" } };
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const s = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...s, settings: { ...DEFAULT_STATE.settings, ...(s.settings || {}) } };
  } catch { return structuredClone(DEFAULT_STATE); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage ไม่พร้อมใช้ */ } }
function markStudied() {
  const t = todayStr();
  if (!S.studyDates.includes(t)) { S.studyDates.push(t); S.studyDates = S.studyDates.slice(-400); }
}
function streak() {
  const set = new Set(S.studyDates); let n = 0; const d = new Date();
  if (!set.has(todayStr(d))) d.setDate(d.getDate() - 1);
  while (set.has(todayStr(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function currentDay() {
  for (const l of LESSONS) if (!S.done[l.day]) return l.day;
  return TOTAL_DAYS;
}
function applyTheme() {
  const t = S.settings.theme;
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

/* ---------- Cards / SRS ---------- */
const ALL_CARDS = LESSONS.flatMap(l => l.vocab.map((v, i) => ({ id: `d${l.day}-${i}`, day: l.day, kana: v[0], kanji: v[1], ro: v[2], th: v[3] })));
const INTERVALS = [0, 1, 2, 4, 7, 15, 30];
function dueCards() {
  const t = todayStr();
  return ALL_CARDS.filter(c => S.srs[c.id] && S.srs[c.id].due <= t);
}
function learnedCount() { return Object.keys(S.srs).filter(id => (S.srs[id].box || 0) >= 2).length; }
function grade(card, g) {
  const cur = S.srs[card.id] || { box: 0, due: todayStr() };
  let box = cur.box || 0;
  if (g === 0) box = 0; else if (g === 1) box = Math.min(box + 1, INTERVALS.length - 1); else box = Math.min(box + 2, INTERVALS.length - 1);
  S.srs[card.id] = { box, due: g === 0 ? todayStr() : addDays(INTERVALS[box]) };
  markStudied(); save();
}

/* ---------- เสียง (Web Speech API) ---------- */
let jaVoices = [];
let warnedNoVoice = false;
function loadVoices() {
  if (!("speechSynthesis" in window)) return;
  jaVoices = speechSynthesis.getVoices().filter(v => /^ja(-|_|$)/i.test(v.lang));
}
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function pickVoice() {
  if (!jaVoices.length) return null;
  return jaVoices.find(v => v.name === S.settings.voice)
      || jaVoices.find(v => /google|kyoko|nanami|haruka|otoya/i.test(v.name))
      || jaVoices[0];
}
function cleanForSpeech(t) {
  return String(t).replace(/～/g, "").replace(/\s*\/\s*/g, "、").replace(/…/g, "");
}
function speak(text, btn, onend) {
  if (!("speechSynthesis" in window)) { toast("เบราว์เซอร์นี้ไม่รองรับเสียง ลองใช้ Chrome หรือ Edge"); onend && onend(); return; }
  speechSynthesis.cancel();
  $$(".speak.playing").forEach(b => b.classList.remove("playing"));
  const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
  u.lang = "ja-JP"; u.rate = S.settings.rate;
  const v = pickVoice(); if (v) u.voice = v;
  else if (!warnedNoVoice) { warnedNoVoice = true; toast("ไม่พบเสียงภาษาญี่ปุ่นในเครื่อง — ติดตั้ง Japanese voice ในระบบ หรือใช้ Chrome/Edge", 5000); }
  if (btn) btn.classList.add("playing");
  u.onend = u.onerror = () => { if (btn) btn.classList.remove("playing"); onend && onend(); };
  speechSynthesis.speak(u);
}
const speakBtn = (text, label = "ฟังเสียง") =>
  `<button class="speak" data-say="${esc(text)}" aria-label="${esc(label)}" title="${esc(label)}">▶</button>`;
document.addEventListener("click", e => {
  const b = e.target.closest("[data-say]");
  if (b) { e.preventDefault(); speak(b.dataset.say, b.classList.contains("speak") ? b : null); }
});
const gtLink = jp => `https://translate.google.com/?sl=ja&tl=th&text=${encodeURIComponent(cleanForSpeech(jp))}&op=translate`;
const jishoLink = jp => `https://jisho.org/search/${encodeURIComponent(cleanForSpeech(jp).split("、")[0])}`;

/* ---------- Timer 1 ชั่วโมง (ทำงานต่อแม้เปลี่ยนหน้า) ---------- */
const T = { day: null, total: 3600, left: 3600, running: false, id: null, lastBlock: null };
function blockAt(elapsedSec) {
  let acc = 0;
  for (const b of HOUR_PLAN) { acc += b.min * 60; if (elapsedSec < acc) return b; }
  return HOUR_PLAN[HOUR_PLAN.length - 1];
}
function fmt(sec) { const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }
function timerStart(day) {
  if (T.day !== day) { timerReset(); T.day = day; }
  if (T.running) return;
  T.running = true; markStudied(); save();
  T.id = setInterval(() => {
    T.left = Math.max(0, T.left - 1);
    const b = blockAt(T.total - T.left);
    if (T.lastBlock && b.id !== T.lastBlock) {
      toast(`⏰ ถึงช่วง: ${b.title} (${b.min} นาที)`, 4000);
      const el = document.getElementById(`blk-${b.id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    T.lastBlock = b.id;
    if (T.left === 0) { timerPause(); toast("🎉 ครบ 1 ชั่วโมงแล้ว! อย่าลืมติ๊กช่วงที่ทำเสร็จ", 5000); }
    paintTimer();
  }, 1000);
  T.lastBlock = blockAt(T.total - T.left).id;
  paintTimer();
}
function timerPause() { T.running = false; clearInterval(T.id); paintTimer(); }
function timerReset() { timerPause(); T.left = T.total; T.lastBlock = null; paintTimer(); }
function paintTimer() {
  const box = $("#timer");
  if (!box || Number(box.dataset.day) !== T.day) return;
  const elapsed = T.total - T.left; const b = blockAt(elapsed);
  $(".clock", box).textContent = fmt(T.left);
  $(".now", box).textContent = T.running || elapsed > 0 ? `กำลังอยู่ช่วง: ${b.icon} ${b.title}` : "กด เริ่ม เพื่อจับเวลา 60 นาที";
  $("#tStart", box).textContent = T.running ? "หยุดชั่วคราว" : (elapsed > 0 ? "ทำต่อ" : "เริ่ม");
  // แถบความคืบหน้าแต่ละช่วง
  let acc = 0;
  HOUR_PLAN.forEach(p => {
    const seg = document.querySelector(`.seg[data-b="${p.id}"] > i`);
    if (seg) { const pct = Math.min(100, Math.max(0, (elapsed - acc) / (p.min * 60) * 100)); seg.style.width = pct + "%"; }
    acc += p.min * 60;
    const blk = document.getElementById(`blk-${p.id}`);
    if (blk) blk.classList.toggle("active", (T.running || elapsed > 0) && p.id === b.id);
  });
}

/* ---------- Router ---------- */
const routes = { "": viewHome, day: viewDay, cards: viewCards, kana: viewKana, quiz: viewQuiz, links: viewLinks, settings: viewSettings };
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, qs] = h.split("?");
  const parts = path.split("/").filter(Boolean);
  return { name: parts[0] || "", args: parts.slice(1), q: new URLSearchParams(qs || "") };
}
function render() {
  const r = parseHash();
  const fn = routes[r.name] || viewHome;
  $$("#nav a").forEach(a => a.classList.toggle("active", a.dataset.nav === (r.name || "home")));
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  stopShadow();
  document.onkeydown = null;
  $("#app").innerHTML = "";
  fn(r);
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", render);

/* =========================================================
   หน้าแรก
   ========================================================= */
function viewHome() {
  const cur = currentDay(); const L = LESSONS[cur - 1];
  const doneN = Object.keys(S.done).length; const pct = Math.round(doneN / TOTAL_DAYS * 100);
  const due = dueCards().length;
  $("#app").innerHTML = `
  <section class="hero">
    <div class="card hero-main stack">
      <div class="big-kana" aria-hidden="true">あ</div>
      <div class="eyebrow">Level 1 · บทเรียนวันนี้</div>
      <h1>วันที่ ${cur}: ${esc(L.title)}</h1>
      <p class="muted">${HOUR_PLAN.map(b => `${b.title} ${b.min}′`).join(" · ")}</p>
      <div class="row">
        <a class="btn primary" href="#/day/${cur}">▶ เริ่มเรียน 1 ชั่วโมง</a>
        <a class="btn" href="#/cards/review">↻ ทบทวนการ์ด ${due ? `<span class="pill">${due}</span>` : ""}</a>
      </div>
    </div>
    <div class="card stack">
      <div class="stats">
        <div class="stat"><b>${doneN}/${TOTAL_DAYS}</b><span>วันที่เรียนจบ</span></div>
        <div class="stat"><b>${streak()}</b><span>วันติดต่อกัน 🔥</span></div>
        <div class="stat"><b>${learnedCount()}</b><span>คำที่จำได้</span></div>
      </div>
      <div>
        <div class="row small muted" style="justify-content:space-between"><span>ความคืบหน้า Level 1</span><span>${pct}%</span></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </div>
      <p class="small muted" style="margin:0">เรียนวันละ 1 บทเรียน ทบทวนการ์ดทุกวันตามรอบ (ระบบจะนัดให้เอง)</p>
    </div>
  </section>

  <section class="stack" style="margin-top:28px">
    <h2>เส้นทาง 20 วัน</h2>
    <div class="path">
      ${LESSONS.map(l => `
        <a href="#/day/${l.day}" class="${S.done[l.day] ? "done" : ""} ${l.day === cur ? "current" : ""}">
          <span class="num">DAY ${l.day}</span>${S.done[l.day] ? '<span class="check">✓</span>' : ""}
          <span class="t">${esc(l.title)}</span>
          <span class="small muted">${kanaLabel(l)}</span>
        </a>`).join("")}
    </div>
  </section>`;
}
function kanaLabel(l) {
  if (l.kana.special) return "っ / เสียงยาว";
  if (l.kana.script === "mix") return "ทบทวนตัวอักษร";
  const name = l.kana.script === "kata" ? "คาตาคานะ" : "ฮิรางานะ";
  const first = l.kana.rows.map(r => KANA_ROWS[r].cells.find(Boolean)[0]);
  const shown = l.kana.script === "kata" ? first.map(toKatakana) : first;
  return `${name} ${shown.slice(0, 5).join(" ")}${shown.length > 5 ? "…" : ""}`;
}

/* =========================================================
   บทเรียนรายวัน (1 ชั่วโมง)
   ========================================================= */
function viewDay(r) {
  const day = Math.min(TOTAL_DAYS, Math.max(1, Number(r.args[0]) || currentDay()));
  const L = LESSONS[day - 1];
  const blocks = S.blocks[day] || {};
  const prev = day > 1 ? day - 1 : null, next = day < TOTAL_DAYS ? day + 1 : null;

  $("#app").innerHTML = `
  <div class="lesson-head">
    <div class="stack" style="flex:1;min-width:240px">
      <div class="eyebrow">Day ${day} / ${TOTAL_DAYS} ${S.done[day] ? '<span class="pill done">เรียนจบแล้ว ✓</span>' : ""}</div>
      <h1>${esc(L.title)}</h1>
      <div class="tip small">💡 ${esc(L.tip)}</div>
    </div>
    <div class="timer" id="timer" data-day="${day}">
      <div class="clock">60:00</div>
      <div class="now">กด เริ่ม เพื่อจับเวลา 60 นาที</div>
      <div class="row" style="margin-top:10px">
        <button class="btn primary sm" id="tStart">เริ่ม</button>
        <button class="btn ghost sm" id="tReset">รีเซ็ต</button>
      </div>
    </div>
  </div>
  <div class="plan">${HOUR_PLAN.map(p => `<div class="seg ${blocks[p.id] ? "done" : ""}" data-b="${p.id}" style="flex:${p.min}" title="${esc(p.title)} ${p.min} นาที"><i></i></div>`).join("")}</div>
  <div class="row small muted" style="justify-content:space-between;margin-bottom:16px">
    ${HOUR_PLAN.map(p => `<span>${p.icon} ${p.min}′</span>`).join("")}
  </div>

  <div class="stack">${HOUR_PLAN.map(p => blockHTML(p, L, !!blocks[p.id])).join("")}</div>

  <div class="row" style="justify-content:space-between;margin-top:24px">
    ${prev ? `<a class="btn" href="#/day/${prev}">← วันที่ ${prev}</a>` : "<span></span>"}
    ${next ? `<a class="btn dark" href="#/day/${next}">วันที่ ${next} →</a>` : `<a class="btn dark" href="#/">กลับหน้าแรก</a>`}
  </div>`;

  // timer
  if (T.day !== day && !T.running) { T.day = day; T.left = T.total; T.lastBlock = null; }
  $("#tStart").onclick = () => T.running && T.day === day ? timerPause() : timerStart(day);
  $("#tReset").onclick = () => { T.day = day; timerReset(); };
  if (T.day === day) paintTimer();
  else { $("#timer .now").textContent = `ตัวจับเวลากำลังเดินอยู่ที่วันที่ ${T.day}`; }

  // ติ๊กเสร็จ
  $$(".done-toggle input").forEach(cb => cb.onchange = () => {
    S.blocks[day] = S.blocks[day] || {};
    S.blocks[day][cb.dataset.b] = cb.checked;
    markStudied();
    const all = HOUR_PLAN.every(p => S.blocks[day][p.id]);
    const was = !!S.done[day];
    if (all) S.done[day] = true; else delete S.done[day];
    save();
    if (all && !was) toast(`🎉 จบบทเรียนวันที่ ${day} แล้ว! เก่งมาก`, 4000);
    render();
  });

  // shadowing
  $$("[data-shadow]").forEach(b => b.onclick = () => {
    const pi = Number(b.dataset.shadow);
    const items = (pi < 0 ? L.patterns.flatMap(p => p.ex) : L.patterns[pi].ex).map(e => e[0]);
    startShadow(items, b);
  });
}

function blockHTML(p, L, done) {
  const head = `
    <div class="block-head">
      <div class="block-icon">${done ? "✓" : p.icon}</div>
      <div class="grow">
        <h2 style="margin:0">${esc(p.title)} <span class="muted small">· ${p.min} นาที</span></h2>
        <div class="muted small">${esc(p.desc)}</div>
      </div>
      <label class="done-toggle"><input type="checkbox" data-b="${p.id}" ${done ? "checked" : ""}> เสร็จ</label>
    </div>`;
  let body = "";
  const day = L.day;

  if (p.id === "review") {
    const due = dueCards().length;
    body = due
      ? `<p>มีการ์ดถึงรอบทบทวน <b>${due}</b> ใบ</p><a class="btn primary" href="#/cards/review">↻ เริ่มทบทวน</a>`
      : day === 1
        ? `<p>วันแรกยังไม่มีการ์ดเก่า — วอร์มอัพด้วยการฟังสระ 5 ตัวแล้วพูดตาม</p>
           <div class="row">${KANA_ROWS.a.cells.map(c => `<button class="btn sm jp" data-say="${c[0]}">${c[0]} <span class="muted">${c[1]}</span></button>`).join("")}</div>`
        : `<p class="muted">ยังไม่มีการ์ดถึงรอบ — ทวนคำศัพท์ของวันที่ ${day - 1} แทน</p><a class="btn" href="#/cards/d${day - 1}">ท่องการ์ดวันที่ ${day - 1}</a>`;
  }

  if (p.id === "kana") {
    if (L.kana.special) {
      body = `<p>ฟังเทียบคู่คำต่อไปนี้ — เสียงสั้น/ยาว และ っ ทำให้ความหมายเปลี่ยน</p>
        <div class="vlist">${SPECIAL_KANA.map(s => `
          <div class="vitem">${speakBtn(s[0])}<div><span class="jpw">${s[0]}</span><div class="ro">${esc(s[1])}</div></div><div class="th">${esc(s[2])}</div></div>`).join("")}</div>
        <div class="row" style="margin-top:12px"><a class="btn" href="#/quiz/kana?script=hira&rows=${[...BASIC_ROWS, ...DAKU_ROWS].join(",")}">ทดสอบฮิรางานะทั้งหมด</a></div>`;
    } else if (L.kana.script === "mix") {
      body = `<p>ทบทวนตัวอักษรแบบสุ่ม — เป้าหมายตอบถูก 9/10 ขึ้นไป</p>
        <div class="row">
          <a class="btn primary" href="#/quiz/kana?script=hira&rows=${[...BASIC_ROWS, ...DAKU_ROWS, ...YOON_ROWS].join(",")}">ทดสอบฮิรางานะ</a>
          <a class="btn primary" href="#/quiz/kana?script=kata&rows=${[...BASIC_ROWS, ...DAKU_ROWS].join(",")}">ทดสอบคาตาคานะ</a>
          <a class="btn" href="#/kana">ดูตารางตัวอักษร</a>
        </div>`;
    } else {
      body = kanaGridHTML(L.kana.rows, L.kana.script) +
        `<div class="row" style="margin-top:12px">
          <a class="btn primary" href="#/quiz/kana?script=${L.kana.script}&rows=${L.kana.rows.join(",")}">ทดสอบตัวอักษรวันนี้</a>
          <a class="btn" href="#/kana">ตารางทั้งหมด</a>
        </div>`;
    }
  }

  if (p.id === "vocab") {
    body = `<div class="vlist">${L.vocab.map(v => vocabItemHTML(v)).join("")}</div>
      <div class="row" style="margin-top:12px">
        <a class="btn primary" href="#/cards/d${day}">🃏 ท่องด้วยการ์ด (${L.vocab.length} ใบ)</a>
      </div>`;
  }

  if (p.id === "pattern") {
    body = L.patterns.map((pt, i) => `
      <div class="pattern">
        <div class="row" style="justify-content:space-between">
          <h3 class="jp" style="margin:0">${esc(pt.title)}</h3>
          <button class="btn sm" data-shadow="${i}">🔁 Shadowing</button>
        </div>
        ${pt.explain ? `<p class="muted small" style="margin:.2em 0 .4em">${esc(pt.explain)}</p>` : ""}
        ${pt.ex.map(e => `
          <div class="ex">${speakBtn(e[0])}
            <div>
              <div class="jps">${esc(e[0])}</div>
              ${S.settings.romaji ? `<div class="ro">${esc(e[1])}</div>` : ""}
              <div class="th">${esc(e[2])} <a class="gt" href="${gtLink(e[0])}" target="_blank" rel="noopener">Google แปล ↗</a></div>
            </div>
          </div>`).join("")}
      </div>`).join("") +
      `<p class="small muted">Shadowing = ฟังแล้วพูดตามทันทีในช่วงเงียบ ระบบจะเว้นจังหวะให้พูดตามหลังแต่ละประโยค</p>`;
  }

  if (p.id === "extra") {
    const links = [...(L.links || []), ["NHK Easy Japanese (ไทย)", EXTERNAL_LINKS[0].items[0][1]]];
    body = `<div class="row">
        <a class="btn primary" href="#/quiz/listen?day=${day}">🎧 ทดสอบฟังเสียงวันนี้</a>
        ${links.map(l => `<a class="btn" href="${esc(l[1])}" target="_blank" rel="noopener">${esc(l[0])} ↗</a>`).join("")}
        <a class="btn" href="#/links">ลิงก์ทั้งหมด</a>
      </div>`;
  }

  return `<section class="card block ${done ? "done" : ""}" id="blk-${p.id}">${head}<div style="margin-top:14px">${body}</div></section>`;
}

function vocabItemHTML(v) {
  return `<div class="vitem">
    ${speakBtn(v[0])}
    <div>
      <span class="jpw">${esc(v[0])}</span>${v[1] ? `<span class="kanji">${esc(v[1])}</span>` : ""}
      ${S.settings.romaji ? `<div class="ro">${esc(v[2])}</div>` : ""}
    </div>
    <div class="th">${esc(v[3])}<br><a class="ext" href="${jishoLink(v[1] || v[0])}" target="_blank" rel="noopener">jisho ↗</a></div>
  </div>`;
}

function kanaGridHTML(rows, script, compact = false) {
  const five = rows.filter(r => KANA_ROWS[r].cells.length === 5);
  const three = rows.filter(r => KANA_ROWS[r].cells.length === 3);
  if (five.length && three.length) return kanaGridHTML(five, script, compact) + `<div style="height:12px"></div>` + kanaGridHTML(three, script, compact);
  const conv = script === "kata" ? toKatakana : (x => x);
  const isYoon = three.length > 0;
  return `<div class="kana-grid ${isYoon ? "yoon" : ""} ${compact ? "compact" : ""}">${rows.map(r => {
    const row = KANA_ROWS[r];
    const name = `<div class="kana-row-name">${esc(script === "kata" ? conv(row.name) : row.name)}</div>`;
    const cells = row.cells.map(c => c ? `<button class="kcell" data-say="${conv(c[0])}"><span class="k">${conv(c[0])}</span><span class="r">${c[1]}</span></button>` : `<div class="kcell empty"></div>`).join("");
    return (rows.length > 1 && !compact ? name : "") + cells;
  }).join("")}</div>`;
}

/* Shadowing: เล่นทีละประโยค เว้นช่วงให้พูดตาม */
const SH = { on: false, timer: null };
function stopShadow() { SH.on = false; clearTimeout(SH.timer); }
function startShadow(items, btn) {
  if (SH.on) { stopShadow(); speechSynthesis.cancel(); btn.textContent = "🔁 Shadowing"; return; }
  SH.on = true; btn.textContent = "■ หยุด"; let i = 0;
  const next = () => {
    if (!SH.on || i >= items.length) { stopShadow(); btn.textContent = "🔁 Shadowing"; return; }
    const text = items[i++];
    toast(`พูดตาม: ${text}`, 3500);
    speak(text, null, () => { if (!SH.on) return; SH.timer = setTimeout(next, Math.max(1800, text.length * 220 / S.settings.rate)); });
  };
  next();
}

/* =========================================================
   การ์ดคำศัพท์
   ========================================================= */
function viewCards(r) {
  const mode = r.args[0] || "";
  if (!mode) return cardsMenu();
  let cards = [], title = "";
  if (mode === "review") { cards = dueCards(); title = "ทบทวนตามรอบ"; }
  else if (mode === "all") { const max = currentDay(); cards = ALL_CARDS.filter(c => c.day <= max); title = `ทุกคำจนถึงวันที่ ${max}`; }
  else if (/^d\d+$/.test(mode)) { const d = Number(mode.slice(1)); cards = ALL_CARDS.filter(c => c.day === d); title = `วันที่ ${d}: ${LESSONS[d - 1]?.title || ""}`; }
  if (!cards.length) {
    $("#app").innerHTML = `<div class="card stack" style="text-align:center">
      <h2>ยังไม่มีการ์ดในชุดนี้ 🎉</h2>
      <p class="muted">${mode === "review" ? "ไม่มีการ์ดถึงรอบทบทวนวันนี้ ไปเรียนคำใหม่ได้เลย" : "เลือกชุดอื่น"}</p>
      <div class="row" style="justify-content:center"><a class="btn primary" href="#/cards/d${currentDay()}">ท่องคำของวันที่ ${currentDay()}</a><a class="btn" href="#/cards">เลือกชุดการ์ด</a></div>
    </div>`;
    return;
  }
  runDeck(shuffle(cards), title, r.q.get("dir") || "jp");
}

function cardsMenu() {
  const cur = currentDay(); const due = dueCards().length;
  $("#app").innerHTML = `
    <h1>การ์ดคำศัพท์</h1>
    <p class="muted">ระบบทบทวนแบบเว้นระยะ (Spaced Repetition): กด “จำได้” การ์ดจะกลับมาอีกใน 1, 2, 4, 7, 15, 30 วัน กด “จำไม่ได้” จะวนกลับมาวันนี้</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
      <a class="card link-card" href="#/cards/review"><b>↻ ถึงรอบทบทวน</b><span>${due} ใบ</span></a>
      <a class="card link-card" href="#/cards/d${cur}"><b>🃏 คำใหม่วันนี้ (วันที่ ${cur})</b><span>${LESSONS[cur - 1].vocab.length} ใบ</span></a>
      <a class="card link-card" href="#/cards/all"><b>📚 ทั้งหมดที่เรียนมา</b><span>${ALL_CARDS.filter(c => c.day <= cur).length} ใบ</span></a>
    </div>
    <h2 style="margin-top:28px">เลือกตามวัน</h2>
    <div class="path">${LESSONS.map(l => `<a href="#/cards/d${l.day}"><span class="num">DAY ${l.day}</span><span class="t">${esc(l.title)}</span><span class="small muted">${l.vocab.length} คำ</span></a>`).join("")}</div>
    <h2 style="margin-top:28px">รายการคำศัพท์ทั้งหมด</h2>
    <div class="vlist">${LESSONS.filter(l => l.day <= cur).flatMap(l => l.vocab).map(vocabItemHTML).join("")}</div>`;
}

function runDeck(queue, title, dir) {
  let idx = 0, flipped = false; const total = queue.length; let known = 0;
  const app = $("#app");
  app.innerHTML = `
    <div class="deck-bar">
      <div><div class="eyebrow">การ์ดคำศัพท์</div><h1 style="margin:0">${esc(title)}</h1></div>
      <div class="row">
        <div class="seg-ctl" role="group" aria-label="ทิศทาง">
          <button data-dir="jp" class="${dir === "jp" ? "on" : ""}">ญี่ปุ่น → ไทย</button>
          <button data-dir="th" class="${dir === "th" ? "on" : ""}">ไทย → ญี่ปุ่น</button>
        </div>
        <a class="btn sm" href="#/cards">เปลี่ยนชุด</a>
      </div>
    </div>
    <div class="deck-progress" style="margin-top:20px">
      <div class="row small muted" style="justify-content:space-between"><span id="dpTxt"></span><span>Space = พลิก · 1/2/3 = ให้คะแนน</span></div>
      <div class="progress"><i id="dpBar"></i></div>
    </div>
    <div class="flash-wrap"><div class="flash" id="flash" tabindex="0" aria-live="polite">
      <div class="face front" id="front"></div><div class="face back" id="back"></div>
    </div></div>
    <div class="grade hidden" id="grade">
      <button class="btn again" data-g="0">จำไม่ได้<small>อีกครั้งวันนี้</small></button>
      <button class="btn good" data-g="1">พอจำได้<small>ทบทวนเร็วๆ นี้</small></button>
      <button class="btn easy" data-g="2">จำได้แม่น<small>ข้ามไปนานขึ้น</small></button>
    </div>
    <p class="row" style="justify-content:center;margin-top:16px"><button class="btn sm" id="flipBtn">พลิกการ์ด</button></p>`;

  $$("[data-dir]").forEach(b => b.onclick = () => { location.hash = `#/cards/${parseHash().args[0]}?dir=${b.dataset.dir}`; });

  const show = () => {
    if (idx >= queue.length) return finish();
    const c = queue[idx]; flipped = false;
    $("#flash").classList.remove("flipped"); $("#grade").classList.add("hidden");
    const jpSide = `<div class="main-jp">${esc(c.kana)}</div>${c.kanji ? `<div class="sub jp">${esc(c.kanji)}</div>` : ""}`;
    const roSide = S.settings.romaji ? `<div class="sub">${esc(c.ro)}</div>` : "";
    const thSide = `<div class="main-th">${esc(c.th)}</div>`;
    const sayBtn = `<button class="speak" data-say="${esc(c.kana)}" aria-label="ฟังเสียง">▶</button>`;
    if (dir === "jp") {
      $("#front").innerHTML = `${jpSide}${sayBtn}<div class="hint">แตะเพื่อดูความหมาย</div>`;
      $("#back").innerHTML = `${thSide}<div class="jp sub">${esc(c.kana)}</div>${roSide}${sayBtn}<a class="small" href="${jishoLink(c.kanji || c.kana)}" target="_blank" rel="noopener">ดูใน jisho ↗</a>`;
      if (S.settings.autoSpeak) speak(c.kana);
    } else {
      $("#front").innerHTML = `${thSide}<div class="hint">นึกคำญี่ปุ่นแล้วแตะเพื่อเฉลย</div>`;
      $("#back").innerHTML = `${jpSide}${roSide}${sayBtn}`;
    }
    $("#dpTxt").textContent = `ใบที่ ${Math.min(idx + 1, queue.length)} / ${queue.length}  ·  จำได้ ${known}/${total}`;
    $("#dpBar").style.width = (known / total * 100) + "%";
  };
  const flip = () => {
    flipped = !flipped; $("#flash").classList.toggle("flipped", flipped);
    if (flipped) { $("#grade").classList.remove("hidden"); if (dir === "th" && S.settings.autoSpeak) speak(queue[idx].kana); }
  };
  const doGrade = g => {
    if (!flipped) return;
    const c = queue[idx]; grade(c, g);
    if (g === 0) queue.push(c); else known++;
    idx++; show();
  };
  const finish = () => {
    document.onkeydown = null;
    app.innerHTML = `<div class="card stack" style="text-align:center">
      <div style="font-size:3rem">🎉</div><h2>ท่องครบ ${total} ใบแล้ว</h2>
      <p class="muted">การ์ดจะกลับมาให้ทบทวนตามรอบเอง</p>
      <div class="row" style="justify-content:center">
        <a class="btn primary" href="#/day/${currentDay()}">กลับไปบทเรียน</a>
        <a class="btn" href="#/quiz/listen?day=${queue[0].day}">ทดสอบฟังเสียง</a>
        <a class="btn" href="#/cards">ชุดอื่น</a>
      </div></div>`;
  };
  $("#flash").onclick = e => { if (!e.target.closest("[data-say],a")) flip(); };
  $("#flipBtn").onclick = flip;
  $$("#grade [data-g]").forEach(b => b.onclick = () => doGrade(Number(b.dataset.g)));
  document.onkeydown = e => {
    if (e.target.matches("input,select,textarea")) return;
    if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); flip(); }
    else if (["1","2","3"].includes(e.key)) doGrade(Number(e.key) - 1);
    else if (e.key === "p" || e.key === "P") speak(queue[idx]?.kana || "");
  };
  show();
}

/* =========================================================
   ตารางตัวอักษร
   ========================================================= */
function viewKana(r) {
  const script = r.q.get("s") === "kata" ? "kata" : "hira";
  $("#app").innerHTML = `
    <div class="deck-bar">
      <div><div class="eyebrow">ตัวอักษร</div><h1 style="margin:0">${script === "kata" ? "คาตาคานะ カタカナ" : "ฮิรางานะ ひらがな"}</h1></div>
      <div class="seg-ctl"><button data-s="hira" class="${script === "hira" ? "on" : ""}">ひらがな</button><button data-s="kata" class="${script === "kata" ? "on" : ""}">カタカナ</button></div>
    </div>
    <p class="muted">แตะตัวอักษรเพื่อฟังเสียง</p>
    <div class="stack">
      <section class="card"><h2>ตัวพื้นฐาน (46 ตัว)</h2>${kanaGridHTML(BASIC_ROWS, script, true)}
        <div class="row" style="margin-top:12px"><a class="btn primary" href="#/quiz/kana?script=${script}&rows=${BASIC_ROWS.join(",")}">ทดสอบชุดนี้</a></div></section>
      <section class="card"><h2>เสียงขุ่น ゛ และ ゜</h2>${kanaGridHTML(DAKU_ROWS, script, true)}
        <div class="row" style="margin-top:12px"><a class="btn primary" href="#/quiz/kana?script=${script}&rows=${DAKU_ROWS.join(",")}">ทดสอบชุดนี้</a></div></section>
      <section class="card"><h2>เสียงควบ (ย่อ ゃ ゅ ょ)</h2>${kanaGridHTML(YOON_ROWS, script, true)}
        <div class="row" style="margin-top:12px"><a class="btn primary" href="#/quiz/kana?script=${script}&rows=${YOON_ROWS.join(",")}">ทดสอบชุดนี้</a></div></section>
    </div>`;
  $$("[data-s]").forEach(b => b.onclick = () => location.hash = `#/kana?s=${b.dataset.s}`);
}

/* =========================================================
   แบบทดสอบ (ตัวอักษร / ฟังเสียง)
   ========================================================= */
function viewQuiz(r) {
  const type = r.args[0];
  if (type === "kana") return kanaQuiz(r.q.get("script") === "kata" ? "kata" : "hira", (r.q.get("rows") || BASIC_ROWS.join(",")).split(",").filter(x => KANA_ROWS[x]));
  if (type === "listen") return listenQuiz(r.q.get("day"));
  const cur = currentDay();
  $("#app").innerHTML = `
    <h1>แบบทดสอบ</h1>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
      <a class="card link-card" href="#/quiz/kana?script=hira&rows=${BASIC_ROWS.join(",")}"><b>あ ฮิรางานะ → โรมาจิ</b><span>สุ่ม 10 ข้อ จากตัวพื้นฐาน</span></a>
      <a class="card link-card" href="#/quiz/kana?script=kata&rows=${BASIC_ROWS.join(",")}"><b>ア คาตาคานะ → โรมาจิ</b><span>สุ่ม 10 ข้อ จากตัวพื้นฐาน</span></a>
      <a class="card link-card" href="#/quiz/listen?day=${cur}"><b>🎧 ฟังเสียง → ความหมาย (วันที่ ${cur})</b><span>ฟังคำศัพท์แล้วเลือกความหมาย</span></a>
      <a class="card link-card" href="#/quiz/listen?day=all"><b>🎧 ฟังเสียง: ทุกคำที่เรียนมา</b><span>สุ่มจากวันที่ 1–${cur}</span></a>
    </div>`;
}

function kanaQuiz(script, rows) {
  const conv = script === "kata" ? toKatakana : (x => x);
  const pool = rows.flatMap(r => KANA_ROWS[r].cells.filter(Boolean)).map(c => ({ q: conv(c[0]), a: c[1] }));
  const uniq = [...new Map(pool.map(p => [p.a + p.q, p])).values()];
  const qs = shuffle(uniq).slice(0, Math.min(10, uniq.length)).map(item => {
    const wrong = shuffle(uniq.filter(x => x.a !== item.a)).slice(0, 3).map(x => x.a);
    return { prompt: `<div class="q-big">${item.q}</div>`, say: item.q, answer: item.a, choices: shuffle([item.a, ...new Set(wrong)]) };
  });
  runQuiz(qs, `ทดสอบ${script === "kata" ? "คาตาคานะ" : "ฮิรางานะ"}`, `#/quiz/kana?script=${script}&rows=${rows.join(",")}`);
}

function listenQuiz(dayParam) {
  const cur = currentDay();
  const pool = dayParam === "all" || !dayParam ? ALL_CARDS.filter(c => c.day <= cur) : ALL_CARDS.filter(c => c.day === Number(dayParam));
  const distract = ALL_CARDS.filter(c => c.day <= Math.max(cur, Number(dayParam) || 0));
  const qs = shuffle(pool).slice(0, Math.min(10, pool.length)).map(c => {
    const wrong = shuffle(distract.filter(x => x.th !== c.th)).slice(0, 3).map(x => x.th);
    return { prompt: `<button class="btn primary" data-say="${esc(c.kana)}" style="font-size:1.4rem;padding:18px 28px">🔊 ฟังอีกครั้ง</button>
      <div class="muted small" style="margin-top:10px">ฟังแล้วเลือกความหมาย</div><div class="reveal jp hidden" style="font-size:1.6rem;margin-top:10px">${esc(c.kana)} <span class="muted small">${esc(c.ro)}</span></div>`,
      say: c.kana, auto: true, answer: c.th, choices: shuffle([c.th, ...wrong]) };
  });
  runQuiz(qs, "ทดสอบการฟัง", `#/quiz/listen?day=${dayParam || "all"}`);
}

function runQuiz(qs, title, again) {
  let i = 0, score = 0;
  const app = $("#app");
  const show = () => {
    if (i >= qs.length) {
      const pct = Math.round(score / qs.length * 100); markStudied(); save();
      app.innerHTML = `<div class="card stack" style="text-align:center">
        <div style="font-size:3rem">${pct >= 90 ? "🏆" : pct >= 70 ? "👍" : "💪"}</div>
        <h2>ได้ ${score} / ${qs.length} คะแนน (${pct}%)</h2>
        <p class="muted">${pct >= 90 ? "ยอดเยี่ยม! ไปต่อได้เลย" : "ลองอีกรอบจนได้ 90% ขึ้นไป"}</p>
        <div class="row" style="justify-content:center"><a class="btn primary" href="${again}" id="againBtn">ทำอีกครั้ง</a><a class="btn" href="#/day/${currentDay()}">กลับไปบทเรียน</a></div></div>`;
      $("#againBtn").onclick = e => { e.preventDefault(); render(); };
      return;
    }
    const q = qs[i];
    app.innerHTML = `
      <div class="deck-bar"><div><div class="eyebrow">${esc(title)}</div><h1 style="margin:0">ข้อ ${i + 1} / ${qs.length}</h1></div><span class="pill">คะแนน ${score}</span></div>
      <div class="progress" style="margin:14px 0"><i style="width:${i / qs.length * 100}%"></i></div>
      <div class="card"><div class="q-prompt">${q.prompt}</div>
        <div class="choices">${q.choices.map(c => `<button class="choice" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      </div>`;
    if (q.auto) setTimeout(() => speak(q.say), 250);
    $$(".choice").forEach(b => b.onclick = () => {
      const ok = b.dataset.c === q.answer;
      if (ok) score++;
      $$(".choice").forEach(x => { x.disabled = true; if (x.dataset.c === q.answer) x.classList.add("right"); });
      if (!ok) b.classList.add("wrong");
      const rv = $(".reveal"); if (rv) rv.classList.remove("hidden");
      speak(q.say);
      setTimeout(() => { i++; show(); }, ok ? 900 : 1900);
    });
  };
  show();
}

/* =========================================================
   ลิงก์ภายนอก
   ========================================================= */
function viewLinks() {
  $("#app").innerHTML = `
    <h1>แหล่งเรียนเพิ่มเติม</h1>
    <p class="muted">ลิงก์จะเปิดในแท็บใหม่ ใช้ในช่วง “ฟังเพิ่ม 5 นาที” ของแต่ละวัน</p>
    <div class="stack">${EXTERNAL_LINKS.map(g => `
      <section><h2>${esc(g.group)}</h2>
        <div class="link-list">${g.items.map(l => `<a class="link-card" href="${esc(l[1])}" target="_blank" rel="noopener"><b>${esc(l[0])}</b><span>${esc(l[2])}</span></a>`).join("")}</div>
      </section>`).join("")}</div>`;
}

/* =========================================================
   ตั้งค่า
   ========================================================= */
function viewSettings() {
  const st = S.settings;
  $("#app").innerHTML = `
    <h1>ตั้งค่า</h1>
    <div class="card stack">
      <div><label for="rate"><b>ความเร็วเสียง</b> <span id="rateV" class="muted">${st.rate.toFixed(2)}×</span></label><br>
        <input id="rate" type="range" min="0.5" max="1.2" step="0.05" value="${st.rate}" style="width:100%;max-width:360px">
        <button class="btn sm" data-say="こんにちは。にほんごを べんきょうしましょう。">▶ ทดสอบเสียง</button></div>
      <div><label for="voice"><b>เสียงพูด</b></label><br>
        <select id="voice" class="btn" style="max-width:100%"><option value="">อัตโนมัติ</option>${jaVoices.map(v => `<option ${v.name === st.voice ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select>
        <div class="small muted">${jaVoices.length ? `พบเสียงญี่ปุ่น ${jaVoices.length} เสียง` : "ยังไม่พบเสียงญี่ปุ่น — ใน Windows: Settings › Time & language › Speech › เพิ่ม Japanese  หรือใช้ Chrome/Edge"}</div></div>
      <label class="done-toggle"><input type="checkbox" id="romaji" ${st.romaji ? "checked" : ""}> แสดงโรมาจิ (ปิดเมื่ออ่านคานะคล่องแล้ว)</label>
      <label class="done-toggle"><input type="checkbox" id="auto" ${st.autoSpeak ? "checked" : ""}> เล่นเสียงอัตโนมัติในการ์ด</label>
      <div><b>ธีม</b><br><div class="seg-ctl">${[["auto","อัตโนมัติ"],["light","สว่าง"],["dark","มืด"]].map(([k, t]) => `<button data-theme-set="${k}" class="${st.theme === k ? "on" : ""}">${t}</button>`).join("")}</div></div>
      <hr style="border:0;border-top:1px solid var(--line)">
      <div class="row"><button class="btn" id="exportBtn">สำรองความคืบหน้า (คัดลอก)</button><button class="btn" id="importBtn">กู้คืน</button>
        <button class="btn" id="resetBtn" style="color:var(--bad);border-color:var(--bad)">ล้างความคืบหน้าทั้งหมด</button></div>
    </div>`;
  $("#rate").oninput = e => { st.rate = Number(e.target.value); $("#rateV").textContent = st.rate.toFixed(2) + "×"; save(); };
  $("#voice").onchange = e => { st.voice = e.target.value; save(); speak("こんにちは"); };
  $("#romaji").onchange = e => { st.romaji = e.target.checked; save(); };
  $("#auto").onchange = e => { st.autoSpeak = e.target.checked; save(); };
  $$("[data-theme-set]").forEach(b => b.onclick = () => { st.theme = b.dataset.themeSet; save(); applyTheme(); render(); });
  $("#exportBtn").onclick = async () => {
    const data = JSON.stringify(S);
    try { await navigator.clipboard.writeText(data); toast("คัดลอกข้อมูลแล้ว เก็บไว้ในโน้ตได้"); } catch { prompt("คัดลอกข้อความนี้เก็บไว้:", data); }
  };
  $("#importBtn").onclick = () => {
    const txt = prompt("วางข้อมูลสำรองที่คัดลอกไว้:"); if (!txt) return;
    try { const s = JSON.parse(txt); S = { ...structuredClone(DEFAULT_STATE), ...s, settings: { ...DEFAULT_STATE.settings, ...(s.settings || {}) } }; save(); applyTheme(); toast("กู้คืนเรียบร้อย"); render(); }
    catch { toast("ข้อมูลไม่ถูกต้อง"); }
  };
  $("#resetBtn").onclick = () => { if (confirm("ล้างความคืบหน้าทั้งหมด? (ย้อนกลับไม่ได้)")) { S = structuredClone(DEFAULT_STATE); save(); applyTheme(); toast("ล้างแล้ว"); location.hash = "#/"; } };
}

/* ---------- Start ---------- */
applyTheme();
if (location.hash === "#/day" || location.hash === "#/day/") location.hash = `#/day/${currentDay()}`;
render();
})();
