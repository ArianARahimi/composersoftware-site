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

// home page title: a Game Boy style raster slide-in. The title is cut into
// rows one font pixel tall; even rows slide in from the left, odd rows from
// the right, each a little earlier or later along a sine wave.

const title = document.querySelector(".hero h1");
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function rasterIn(h) {
  const px = parseFloat(getComputedStyle(h).fontSize) / 16;
  const height = Math.round(h.getBoundingClientRect().height);
  const rows = Math.ceil(height / px);
  // each side starts just off its own edge of the screen, so both enter at once
  const range = document.createRange();
  range.selectNodeContents(h);
  const text = range.getBoundingClientRect();
  const fromLeft = -Math.ceil(text.right + 16);
  const fromRight = Math.ceil(window.innerWidth - text.left + 16);
  const box = document.createElement("div");
  box.className = "raster";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < rows; i++) {
    const row = document.createElement("div");
    row.className = "raster-row";
    row.innerHTML = h.innerHTML;
    row.style.clipPath = `inset(${i * px}px 0 ${Math.max(0, height - (i + 1) * px)}px 0)`;
    row.style.setProperty("--from", (i % 2 ? fromRight : fromLeft) + "px");
    row.style.animationDelay = Math.round(130 + 120 * Math.sin((i / rows) * Math.PI * 3)) + "ms";
    box.append(row);
  }
  h.append(box);
  let left = rows;
  box.addEventListener("animationend", () => {
    if (--left > 0) return;
    box.remove();
    h.classList.remove("raster-wait");
  });
}

if (title && !calm) {
  title.classList.add("raster-wait");
  const start = () => { if (title.classList.contains("raster-wait") && !title.querySelector(".raster")) rasterIn(title); };
  document.fonts.ready.then(start);
  // never leave the title hidden if fonts are slow
  setTimeout(() => { if (!title.querySelector(".raster")) title.classList.remove("raster-wait"); }, 1500);
}
