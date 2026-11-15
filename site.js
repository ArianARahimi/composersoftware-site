// the tagline is a prompt you can type over (desktop only).
// Other scripts can follow it through its "text" event and stop typing
// by setting data-locked on the line.

const line = document.querySelector(".typer");
const desktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (line && desktop) {
  const text = line.querySelector(".type");
  const cursor = line.querySelector(".cursor");
  const input = document.createElement("input");

  input.type = "text";
  input.value = text.textContent;
  input.maxLength = 30;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Type here");
  line.append(input);

  function toEnd() {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }

  function show() {
    text.classList.add("live");
    text.textContent = input.value;
    toEnd();
    cursor.style.animation = "none";
    void cursor.offsetWidth;
    cursor.style.animation = "blink 1s steps(1) 0.5s infinite";
    line.dispatchEvent(new CustomEvent("text", { detail: input.value }));
  }

  input.addEventListener("input", show);
  input.addEventListener("beforeinput", (e) => {
    if (line.dataset.locked && e.inputType.startsWith("insert")) e.preventDefault();
  });
  input.addEventListener("keyup", toEnd);
  input.addEventListener("click", toEnd);

  // start typing anywhere on the page, no click needed
  document.addEventListener("keydown", (e) => {
    if (e.target === input || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key === "Backspace") {
      input.value = input.value.slice(0, -1);
    } else if (e.key.length === 1) {
      if (!line.dataset.locked && input.value.length < input.maxLength) input.value += e.key;
    } else {
      return;
    }
    e.preventDefault();
    input.focus({ preventScroll: true });
    show();
  });
}

// download windows close on a click well outside them, after a choice, or on Escape.
// The slack keeps a near miss from closing the window by accident.

const downloads = document.querySelectorAll(".download");
const slack = 24;
const shadow = 12;

function nearWindow(d, x, y) {
  const a = d.querySelector("summary").getBoundingClientRect();
  const b = d.querySelector(".dos").getBoundingClientRect();
  return x >= Math.min(a.left, b.left) - slack &&
         x <= Math.max(a.right, b.right + shadow) + slack &&
         y >= Math.min(a.top, b.top) - slack &&
         y <= Math.max(a.bottom, b.bottom + shadow) + slack;
}

document.addEventListener("click", (e) => {
  for (const d of downloads) {
    if (!d.open) continue;
    if (d.contains(e.target)) {
      if (e.target.closest(".dos-menu a")) setTimeout(() => { d.open = false; });
      continue;
    }
    if (!nearWindow(d, e.clientX, e.clientY)) d.open = false;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  for (const d of downloads) d.open = false;
});

// project windows: clicking the window opens its page. Download and Source
// get a wide margin of error; the window only counts well away from them,
// never while a download window is open, and only highlights when a click
// would really open the page.

const cardSlack = 16;

function nearFoot(card, x, y) {
  for (const el of card.querySelectorAll(".win-foot a, .win-foot summary")) {
    const r = el.getBoundingClientRect();
    if (x >= r.left - cardSlack && x <= r.right + cardSlack &&
        y >= r.top - cardSlack && y <= r.bottom + cardSlack) return true;
  }
  return false;
}

function opensPage(card, e) {
  if (e.target.closest("a, summary, details")) return false;
  if (document.querySelector(".download[open]")) return false;
  return !nearFoot(card, e.clientX, e.clientY);
}

for (const card of document.querySelectorAll(".card-link")) {
  card.addEventListener("mousemove", (e) => card.classList.toggle("hot", opensPage(card, e)));
  card.addEventListener("mouseleave", () => card.classList.remove("hot"));
  card.addEventListener("click", (e) => {
    if (!opensPage(card, e) || String(getSelection())) return;
    card.classList.remove("hot");
    if (e.ctrlKey || e.metaKey) window.open(card.dataset.href);
    else location.href = card.dataset.href;
  });
}


// home page title intro: one effect, picked at random on each visit (never
// the same twice in a row). Only the home page fetches intro code: the shared
// parts (intro/core.js) and the picked effect's file, downloaded together.

const title = document.querySelector(".hero h1");
// <html class="intro"> is set by an inline script in index.html before the first
// paint (skipped for reduced motion), so the plain title never flashes first
const intro = document.documentElement.classList;
const INTRO_NAMES = ["flip", "hop", "sand", "laser", "blackhole", "print", "glitch", "interlace", "ripple", "squash"];
const scriptUrl = document.currentScript.src;

function pickEffect() {
  let last = "";
  try { last = localStorage.getItem("intro-effect") || ""; } catch { /* no storage */ }
  const choices = INTRO_NAMES.filter((n) => n !== last);
  const name = choices[Math.floor(Math.random() * choices.length)];
  try { localStorage.setItem("intro-effect", name); } catch { /* no storage */ }
  return name;
}

// intro/<name>.js for each name, with this script's ?v= so a redeploy never
// mixes old and new files; they download together and run in order
function loadIntro(names) {
  const v = new URL(scriptUrl).searchParams.get("v");
  return Promise.all(names.map((name) => new Promise((ok, fail) => {
    const s = document.createElement("script");
    const url = new URL(`intro/${name}.js`, scriptUrl);
    if (v) url.searchParams.set("v", v);
    s.src = url;
    s.async = false;
    s.onload = ok;
    s.onerror = fail;
    document.head.append(s);
  })));
}

if (title && intro.contains("intro")) {
  const name = pickEffect();
  const reveal = () => intro.remove("intro");
  loadIntro(["core", name])
    .then(() => Promise.all([document.fonts.ready, INTROS[name].chars && document.fonts.load('16px "IBM VGA"', INTROS[name].chars)]))
    .then(() => {
      if (!intro.contains("intro")) return;             // too late, the title is showing
      INTROS[name](title, () => {
        reveal();
        sheen(title);
      });
    }, reveal);
  // never leave the title hidden if scripts or fonts are slow
  setTimeout(() => { if (!title.querySelector(".raster")) reveal(); }, 1500);
}
