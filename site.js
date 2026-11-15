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
// the same twice in a row). The title is cut into rows as thin as one pixel
// of the regular text, so the effect matches the rest of the page even though
// the title is bigger. Each effect moves the rows and calms down
// until the plain title is left; positions snap to whole pixels.

const title = document.querySelector(".hero h1");
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const RASTER_MS = 1300;

// each effect: (row index, row position in title pixels, progress 0..1, title pixel)
// returns { x, y } for that row
const EFFECTS = {
  // neighbouring rows swing in opposite directions
  interlace: (i, r, p, big) => ({ x: (i % 2 ? 1 : -1) * 24 * big * (1 - p) ** 2 * Math.cos(r * 0.35 - p * 16) }),
  // all rows sway together in a travelling wave, like a flag
  ripple: (_i, r, p, big) => ({ x: 36 * big * (1 - p) ** 2 * Math.sin(r * 0.25 - p * 14) }),
  // rows bunch up and stretch vertically
  squash: (_i, r, p, big) => ({ y: 10 * big * (1 - p) ** 2 * Math.sin(r * 0.2 + p * 12) }),
};

function pickEffect() {
  const names = Object.keys(EFFECTS);
  let last = "";
  try { last = localStorage.getItem("intro-effect") || ""; } catch { /* no storage */ }
  const choices = names.filter((n) => n !== last);
  const name = choices[Math.floor(Math.random() * choices.length)];
  try { localStorage.setItem("intro-effect", name); } catch { /* no storage */ }
  return name;
}

function rasterIn(h) {
  const effect = EFFECTS[pickEffect()];
  const px = parseFloat(getComputedStyle(document.body).fontSize) / 16;   // regular text pixel
  const big = parseFloat(getComputedStyle(h).fontSize) / 16;              // title pixel
  const height = Math.round(h.getBoundingClientRect().height);
  const count = Math.ceil(height / px);
  const box = document.createElement("div");
  box.className = "raster";
  box.setAttribute("aria-hidden", "true");
  const rows = [];
  for (let i = 0; i < count; i++) {
    const row = document.createElement("div");
    row.className = "raster-row";
    row.innerHTML = h.innerHTML;
    row.style.clipPath = `inset(${i * px}px 0 ${Math.max(0, height - (i + 1) * px)}px 0)`;
    box.append(row);
    rows.push(row);
  }
  h.append(box);

  const snap = (v) => Math.round((v || 0) / px) * px;
  const t0 = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - t0) / RASTER_MS);
    rows.forEach((row, i) => {
      const f = effect(i, i * px / big, p, big);
      row.style.transform = `translate(${snap(f.x)}px, ${snap(f.y)}px)`;
    });
    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      box.remove();
      h.classList.remove("raster-wait");
      sheen(h);
    }
  }
  requestAnimationFrame(frame);
}

// a shine over the title as it lands: a diagonal sweep turns the neon pink
// title white, a second sweep turns it yellow; then the plain heading returns
function sheen(h) {
  const original = h.innerHTML;
  const lines = original.split(/<br\s*\/?>/i);
  // two sweeps along the same "/" diagonal (the bottom row runs one letter
  // ahead of the row above): the first turns each letter white, the second,
  // right after, turns it yellow
  const STEP = 18;
  const longest = Math.max(...lines.map((l) => l.length));
  const pass = (longest + lines.length - 1) * STEP;     // one full sweep
  const hold = pass + 60;                               // white until the second sweep
  h.innerHTML = lines.map((line, row) =>
    [...line].map((ch, col) => {
      const delay = (line.length - 1 - col + lines.length - 1 - row) * STEP;
      return `<span class="sheen-ch" style="animation-delay:${delay}ms;animation-duration:${hold}ms">${ch}</span>`;
    }).join("")
  ).join("<br>");
  const letters = h.querySelectorAll(".sheen-ch");
  let left = letters.length;
  h.addEventListener("animationend", function done() {
    if (--left > 0) return;
    h.removeEventListener("animationend", done);
    h.innerHTML = original;
  });
}

if (title && !calm) {
  title.classList.add("raster-wait");
  const start = () => { if (title.classList.contains("raster-wait") && !title.querySelector(".raster")) rasterIn(title); };
  document.fonts.ready.then(start);
  // never leave the title hidden if fonts are slow
  setTimeout(() => { if (!title.querySelector(".raster")) title.classList.remove("raster-wait"); }, 1500);
}
