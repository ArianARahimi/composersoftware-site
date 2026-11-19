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
  for (const p of document.querySelectorAll(".pick[open]")) p.open = false;
  for (const d of downloads) d.open = false;
});

// tiles with more than one download (macOS): one open at a time, closed by a choice or a
// click anywhere else.
document.addEventListener("click", (e) => {
  for (const p of document.querySelectorAll(".pick[open]")) {
    if (!p.contains(e.target)) p.open = false;
    else if (e.target.closest(".pick-menu a")) setTimeout(() => { p.open = false; });
  }
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


// email addresses are put together here, so they aren't sitting in the page
// for address-harvesting bots; without JavaScript the spelled-out text shows

for (const a of document.querySelectorAll("a.mail")) {
  const address = a.dataset.user + "@" + a.dataset.domain;
  a.href = "mailto:" + address;
  a.textContent = address;
}


// home page title intro: index.html picks the effect before the first paint
// and starts downloading intro/core.js and the effect's file (introReady);
// this runs it once those and the fonts are in. When it is over, however it
// ended, html gets data-intro-done and window an "intro-done" event.

const title = document.querySelector(".hero h1");
const intro = document.documentElement.classList;

if (title && intro.contains("intro")) {
  const name = document.documentElement.dataset.intro;
  let over = false;
  const finished = () => {
    if (over) return;
    over = true;
    document.documentElement.dataset.introDone = "";
    window.dispatchEvent(new Event("intro-done"));
  };
  const reveal = () => intro.remove("intro");
  const skip = () => { reveal(); finished(); };
  (window.introReady || Promise.reject(new Error("no intro")))
    .then(() => Promise.all([document.fonts.ready, INTROS[name].chars && document.fonts.load('16px "IBM VGA"', INTROS[name].chars)]))
    .then(() => {
      if (!intro.contains("intro")) return;             // too late, the title is showing
      INTROS[name](title, () => {
        reveal();
        sheen(title, finished);
      });
    }, skip);
  // never leave the title hidden if scripts or fonts are slow
  setTimeout(() => { if (!title.querySelector(".raster")) skip(); }, 1500);
}

// NEW!: shown on a project for its first 72 hours after its first release (the build writes
// the time). It rises once the tagline has typed, drops behind the name while the project is
// pointed at, and rises and types out again after. The rise and drop are a CSS transition, so
// pointing on and off quickly reverses it from where it is instead of starting over.
const tagline = document.querySelector(".type");
for (const date of document.querySelectorAll(".new-date")) {
  const badge = date.parentElement.querySelector(".new");
  const age = Date.now() - Date.parse(date.textContent);
  if (!badge || !(age < 72 * 3600 * 1000)) continue;
  badge.hidden = false;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const links = [...badge.closest("li").querySelectorAll(".latest-title, .latest-text")];
  let ready = false;
  const update = () => {
    const up = ready && !links.some((l) => l.matches(":hover, :focus-visible"));
    badge.classList.toggle("up", up);
    if (still) badge.classList.toggle("typed", up);   // no transition, so no transitionend
  };
  badge.addEventListener("transitionend", (e) => {
    if (e.target !== badge) return;
    badge.classList.toggle("typed", badge.classList.contains("up"));   // risen: type; down: ready to again
  });
  for (const link of links) {
    for (const event of ["mouseenter", "mouseleave", "focus", "blur"]) link.addEventListener(event, () => setTimeout(update));
  }
  const start = () => { if (!ready) { ready = true; update(); } };
  if (tagline && !still) tagline.addEventListener("animationend", start, { once: true });
  setTimeout(start, still ? 0 : 2400);   // in case the tagline's end is missed
}
