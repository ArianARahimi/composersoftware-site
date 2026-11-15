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
// the title is bigger. Each effect calms down until the plain title is left;
// positions snap to whole pixels.

const title = document.querySelector(".hero h1");
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const RASTER_MS = 1300;

// row effects: (row index, row position in title pixels, progress 0..1,
// title pixel, random phase) returns { x, y } for that row. The random phase
// shifts where the wave starts, so no two visits look the same.
const ROW_EFFECTS = {
  // neighbouring rows swing in opposite directions
  interlace: (i, r, p, big, phase) => ({ x: (i % 2 ? 1 : -1) * 24 * big * (1 - p) ** 2 * Math.cos(r * 0.35 - p * 16 + phase) }),
  // all rows sway together in a travelling wave, like a flag
  ripple: (_i, r, p, big, phase) => ({ x: 36 * big * (1 - p) ** 2 * Math.sin(r * 0.25 - p * 14 + phase) }),
  // rows bunch up and stretch vertically
  squash: (_i, r, p, big, phase) => ({ y: 10 * big * (1 - p) ** 2 * Math.sin(r * 0.2 + p * 12 + phase) }),
};

// every effect: (heading, done) and calls done() once the plain title is back
const EFFECTS = { flip: flipUp, hop: hopIn };
for (const [name, fn] of Object.entries(ROW_EFFECTS)) EFFECTS[name] = (h, done) => rowsIn(h, fn, done);

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
  EFFECTS[pickEffect()](h, () => {
    h.classList.remove("raster-wait");
    sheen(h);
  });
}

const textPixel = () => parseFloat(getComputedStyle(document.body).fontSize) / 16;

function rowsIn(h, effect, done) {
  const phase = Math.random() * Math.PI * 2;
  const px = textPixel();
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
      const f = effect(i, i * px / big, p, big, phase);
      row.style.transform = `translate(${snap(f.x)}px, ${snap(f.y)}px)`;
    });
    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      box.remove();
      done();
    }
  }
  requestAnimationFrame(frame);
}

// the pink title drawn once on a canvas, for canvas effects to copy from;
// anti-aliased edges are thresholded so only whole font pixels remain
function pinkTitle(h) {
  const cs = getComputedStyle(h);
  const w = h.clientWidth;
  const ht = Math.round(h.getBoundingClientRect().height);
  const line = parseFloat(cs.lineHeight);
  const src = document.createElement("canvas");
  src.width = w;
  src.height = ht;
  const sc = src.getContext("2d");
  sc.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = sc.measureText("M");
  const cell = m.width;
  const ascent = m.fontBoundingBoxAscent;
  const base = (line - ascent - m.fontBoundingBoxDescent) / 2 + ascent;
  const letters = [];
  h.innerHTML.split(/<br\s*\/?>/i).forEach((text, row) => [...text].forEach((ch, col) => {
    letters.push({ x: col * cell, y: row * line, row, col });
    sc.fillText(ch, col * cell, row * line + base);
  }));
  const pink = getComputedStyle(document.documentElement).getPropertyValue("--pink").trim();
  const rgb = [1, 3, 5].map((i) => parseInt(pink.slice(i, i + 2), 16));
  const img = sc.getImageData(0, 0, w, ht);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data.set(img.data[i + 3] > 127 ? [...rgb, 255] : [0, 0, 0, 0], i);
  }
  sc.putImageData(img, 0, 0);
  return { src, letters, cell, line, w, ht, pink };
}

// runs draw(ctx, ms, pad) on a canvas over the title, `pad` pixels bigger on
// every side, for RASTER_MS; then removes it and calls done()
function canvasIn(h, t, pad, draw, done) {
  const cv = document.createElement("canvas");
  cv.width = t.w + 2 * pad;
  cv.height = t.ht + 2 * pad;
  cv.style.left = cv.style.top = `${-pad}px`;
  cv.className = "raster raster-canvas";
  cv.setAttribute("aria-hidden", "true");
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  h.append(cv);
  const t0 = performance.now();
  function frame(now) {
    const ms = now - t0;
    ctx.clearRect(0, 0, cv.width, cv.height);
    draw(ctx, ms);
    if (ms < RASTER_MS) {
      requestAnimationFrame(frame);
    } else {
      cv.remove();
      done();
    }
  }
  requestAnimationFrame(frame);
}

// Mode 7 style flip: each letter starts lying flat and turns up around its
// middle to face you (top half tipped away, bottom half towards you), one
// after another from the C to the last e. Drawn a row at a time; rows further
// back are narrower, nearer ones wider. Pixels are only doubled or dropped
// (no smoothing), so it stays as sharp as the font.
function flipUp(h, done) {
  const TURN = 400;                                     // ms for one letter
  const px = textPixel();
  const t = pinkTitle(h);
  const { src, letters, cell, line } = t;
  const pad = Math.ceil(cell / 2 / px) * px;            // the near half grows past its cell
  const far = 3 * line;                                 // camera distance: perspective strength
  const gap = (RASTER_MS - TURN) / Math.max(1, letters.length - 1);
  const mid = Math.round(line / 2 / px) * px;           // pivot, from the letter's top
  canvasIn(h, t, pad, (ctx, ms) => letters.forEach((l, k) => {
    const q = Math.min(1, Math.max(0, (ms - k * gap) / TURN));
    const a = (1 - q) ** 3 * Math.PI / 2;              // 90 degrees flat, 0 upright
    const sin = Math.sin(a), cos = Math.cos(a);
    // draw the screen row at dy (from the letter's top); v = its height above the pivot
    const row = (dy, v) => {
      const s = v * far / (far * cos - v * sin);        // height on the letter, from the pivot
      if (!(Math.abs(s) < mid) || s * v < 0) return false;
      const dw = Math.round(cell * far / (far + s * sin) / px) * px;
      const dx = l.x + Math.round((cell - dw) / 2 / px) * px;
      const sy = l.y + Math.floor((mid - s) / px) * px;
      ctx.drawImage(src, l.x, sy, cell, px, dx + pad, l.y + dy + pad, dw, px);
      return true;
    };
    for (let u = 0; row(mid - px - u, u + px / 2); u += px);        // top half
    for (let u = 0; row(mid + u, -(u + px / 2)); u += px);          // bottom half
  }), done);
}

// hop: the C pops up and bounces; as it lands the S jumps out from behind it
// and hops down to its place, then the next letter jumps out of the S back up
// to the top line, and so on, zig-zagging top, bottom, top, bottom.
function hopIn(h, done) {
  const BOUNCE = 260;                                   // ms of bouncing after a landing
  const px = textPixel();
  const t = pinkTitle(h);
  const { src, cell, line } = t;
  const order = [...t.letters].sort((a, b) => a.col - b.col || a.row - b.row);
  const hop = (RASTER_MS - BOUNCE) / order.length;      // ms in the air; the next one leaves on landing
  const fp = cell / 8;                                  // one font pixel
  const minPiece = 4 * fp * fp;                         // smallest piece of a cut letter worth showing
  const pad = Math.ceil((line / 2 + fp) / px) * px;     // room for the highest bounce
  const snap = (v) => Math.round(v / px) * px;

  // each letter's lit pixels, and its shape grown by a font pixel (a bouncing
  // letter hides that much of whatever is behind it, a black edge)
  const lit = src.getContext("2d").getImageData(0, 0, t.w, t.ht).data;
  const hw = cell + 2 * fp, hh = line + 2 * fp;
  const dots = [], halos = [];
  for (const l of order) {
    const d = [], m = new Uint8Array(hw * hh);
    for (let y = 0; y < line; y++) {
      for (let x = 0; x < cell; x++) {
        if (!lit[((l.y + y) * t.w + l.x + x) * 4 + 3]) continue;
        d.push([x, y]);
        for (let dy = 0; dy <= 2 * fp; dy++) for (let dx = 0; dx <= 2 * fp; dx++) m[(y + dy) * hw + x + dx] = 1;
      }
    }
    dots.push(d);
    halos.push(m);
  }
  const inCell = (r, x, y) => x >= r.x && x < r.x + cell && y >= r.y && y < r.y + line;
  const inHalo = (r, x, y) => {
    const hx = x - r.x + fp, hy = y - r.y + fp;
    return hx >= 0 && hx < hw && hy >= 0 && hy < hh && halos[r.k][hy * hw + hx] === 1;
  };

  canvasIn(h, t, pad, (ctx, ms) => {
    const at = order.map((l, k) => {
      const air = (ms - k * hop) / hop;                // 0..1 in the air
      if (air < 0) return null;
      const from = order[k - 1] || l;                   // the C hops in place
      let x = l.x, y = l.y;
      if (air < 1) {
        x = from.x + (l.x - from.x) * air;
        y = from.y + (l.y - from.y) * air - line / 2 * 4 * air * (1 - air);
      } else {
        // two hops, each lower than the last
        const b = Math.min(1, (ms - (k + 1) * hop) / BOUNCE);
        y -= line / 2 * Math.abs(Math.sin(b * Math.PI * 2)) * (1 - b);
      }
      return { x: snap(x) + pad, y: snap(y) + pad, flying: air < 1, bouncing: snap(y) !== l.y, k };
    });

    // back to front: the letter in the air (it comes out from behind the
    // others), the letters at rest, then the bouncing ones, later in front
    const fly = at.find((p) => p && p.flying);
    const out = at.filter((p) => p && p !== fly);
    const bouncing = out.filter((p) => p.bouncing);
    ctx.fillStyle = t.pink;
    ctx.beginPath();
    // draws what of a letter is not hidden, minus pieces too small to read
    // (slivers cut off by an edge); with `whole`, nothing until a third shows
    const show = (p, hidden, whole) => {
      const open = new Uint8Array(cell * line);
      let cut = false;
      for (const [x, y] of dots[p.k]) {
        if (hidden(p.x + x, p.y + y)) cut = true;
        else open[y * cell + x] = 1;
      }
      if (!cut) {
        ctx.drawImage(src, order[p.k].x, order[p.k].y, cell, line, p.x, p.y, cell, line);
        return;
      }
      const kept = pieces(open, cell, line).filter((q) => q.length >= minPiece).flat();
      if (whole && kept.length * 3 < dots[p.k].length) return;
      for (const i of kept) ctx.rect(p.x + i % cell, p.y + Math.floor(i / cell), 1, 1);
    };
    if (fly) show(fly, (x, y) => out.some((r) => inCell(r, x, y)), true);
    for (const p of out) {
      const front = bouncing.filter((r) => !p.bouncing || r.k > p.k);
      show(p, (x, y) => front.some((r) => inHalo(r, x, y)), false);
    }
    ctx.fill();
  }, done);
}

// 8-connected groups of set cells in a w x h grid, as lists of indices
function pieces(grid, w, h) {
  const seen = new Uint8Array(grid.length);
  const groups = [];
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i] || seen[i]) continue;
    const group = [], stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = (j - x) / w;
      group.push(j);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, n = ny * w + nx;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && grid[n] && !seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

// a shine over the title as it lands: a diagonal sweep turns the neon pink
// title white, a second sweep turns it yellow; then the plain heading returns
function sheen(h) {
  const original = h.innerHTML;
  const lines = original.split(/<br\s*\/?>/i);
  // two sweeps along the same "/" diagonal (the bottom row runs one letter
  // ahead of the row above): the first turns each letter white, the second,
  // right after, turns it yellow
  const STEP = 10;
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
