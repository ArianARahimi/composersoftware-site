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
// <html class="intro"> is set by an inline script in index.html before the first
// paint (skipped for reduced motion), so the plain title never flashes first
const intro = document.documentElement.classList;
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
const EFFECTS = { flip: flipUp, hop: hopIn, sand: sandIn, laser: laserIn, blackhole: blackholeIn, print: printIn, glitch: glitchIn };
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
    intro.remove("intro");
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
    const p = Math.min(1, Math.max(0, now - t0) / RASTER_MS);   // a frame's time can be just before t0
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

// colour helpers for the canvas effects: "#rrggbb" in and out
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, f) => "#" + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * f).toString(16).padStart(2, "0")).join("");
const fade = (a, b, n) => Array.from({ length: n }, (_, i) => mix(a, b, i / (n - 1)));   // n steps, a to b

// squares grouped by colour, so a frame needs one fill per colour
function painter() {
  const paths = new Map();
  return {
    add(colour, x, y, size) {
      let p = paths.get(colour);
      if (!p) paths.set(colour, (p = new Path2D()));
      p.rect(x, y, size, size);
    },
    fill(ctx) {
      for (const [colour, p] of paths) {
        ctx.fillStyle = colour;
        ctx.fill(p);
      }
    },
  };
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
  const lit = [...rgb(pink), 255];
  const img = sc.getImageData(0, 0, w, ht);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data.set(img.data[i + 3] > 127 ? lit : [0, 0, 0, 0], i);
  }
  sc.putImageData(img, 0, 0);
  return { src, letters, cell, line, w, ht, pink, font: sc.font, base, sprites: new Map() };
}

// one character of the title font in one colour, whole font pixels only (cached)
function glyph(t, ch, colour) {
  const key = ch + colour;
  let c = t.sprites.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = Math.ceil(t.cell);
  c.height = Math.ceil(t.line);
  const g = c.getContext("2d");
  g.font = t.font;
  g.fillText(ch, 0, t.base);
  const img = g.getImageData(0, 0, c.width, c.height), on = [...rgb(colour), 255];
  for (let i = 0; i < img.data.length; i += 4) img.data.set(img.data[i + 3] > 127 ? on : [0, 0, 0, 0], i);
  g.putImageData(img, 0, 0);
  t.sprites.set(key, c);
  return c;
}

// runs draw(ctx, ms) on a canvas over the title, `pad` pixels bigger on
// every side, for RASTER_MS; then removes it and calls done(). If drawing
// ever fails, it stops at once, so the title is never left hidden
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
    const ms = Math.max(0, now - t0);                  // a frame's time can be just before t0
    ctx.clearRect(0, 0, cv.width, cv.height);
    let ok = true;
    try {
      draw(ctx, ms);
    } catch (e) {
      ok = false;
      console.error(e);
    }
    if (ok && ms < RASTER_MS) {
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

// sand: every pixel of the title (as small as the regular text's) is a grain
// that falls from a line above it. It fills from the bottom up: lower grains
// land first, each layer scattered at random, and the top grains land as the
// effect ends
function sandIn(h, done) {
  const px = textPixel();
  const t = pinkTitle(h);
  const { src, line } = t;
  const top = -line;                                    // where grains start falling
  const pad = Math.ceil(line / px) * px;
  const fall = 450;                                     // ms to fall the full height
  const SCATTER = 200;                                  // ms of randomness within a layer
  const g = 2 * (t.ht - top) / fall ** 2;               // gravity, pixels per ms squared
  const lit = src.getContext("2d").getImageData(0, 0, t.w, t.ht).data;
  const grains = [];
  for (let y = 0; y < t.ht; y += px) {
    for (let x = 0; x < t.w; x += px) {
      const c = ((y + px / 2 | 0) * t.w + (x + px / 2 | 0)) * 4 + 3;
      if (!lit[c]) continue;
      const drop = Math.sqrt(2 * (y - top) / g);       // ms this grain is in the air
      const height = 1 - y / (t.ht - px);              // 0 bottom row, 1 top row
      const land = fall + height * (RASTER_MS - fall - SCATTER) + Math.random() * SCATTER;
      grains.push({ x, y, start: land - drop, drop });
    }
  }
  canvasIn(h, t, pad, (ctx, ms) => {
    ctx.fillStyle = t.pink;
    ctx.beginPath();
    for (const q of grains) {
      const a = ms - q.start;
      if (a < 0) continue;
      const y = a >= q.drop ? q.y : Math.round((top + g * a * a / 2) / px) * px;
      ctx.rect(q.x + pad, y + pad, px, px);
    }
    ctx.fill();
  }, done);
}

// laser: one beam from above right etches the title a font pixel at a time,
// hopping between random spots (a maze walk over the title box). Each pixel
// glows hot and cools to pink,
// and throws a one-pixel spark that falls and cools out.
function laserIn(h, done) {
  const px = textPixel();
  const t = pinkTitle(h);
  const { src, cell, line } = t;
  const fp = cell / 8;                                  // one font pixel
  const pad = Math.ceil(line / px) * px;
  const BEAM = "#55ffff";
  const COOL = [[0, "#ffffff"], [30, "#ffff55"], [80, "#ffa040"], [130, t.pink]];   // ms after etching
  const SPARK = [[0, "#ffffff"], [60, "#ffff55"], [140, "#ffa040"], [220, "#aa0000"]];
  const SPARK_MS = 300;                                 // a spark's life
  const G = 0.0008;                                     // gravity, pixels per ms squared
  const colourAt = (stops, age) => stops.reduce((c, [from, col]) => (age >= from ? col : c), stops[0][1]);
  const snap = (v) => Math.round(v / px) * px;

  // the lit font pixels
  const gw = Math.floor(t.w / fp), gh = Math.floor(t.ht / fp);
  const data = src.getContext("2d").getImageData(0, 0, t.w, t.ht).data;
  const lit = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (data[((gy * fp + (fp >> 1)) * t.w + gx * fp + (fp >> 1)) * 4 + 3]) lit[gy * gw + gx] = 1;
    }
  }

  // the laser's path: a maze walk over the whole title box from a random spot,
  // backing up when stuck; only lit pixels get etched, so the beam jumps
  // around the title instead of tracing letters in order
  const seen = new Uint8Array(gw * gh);
  const path = [];
  const first = Math.floor(Math.random() * gw * gh);
  const stack = [first];
  seen[first] = 1;
  if (lit[first]) path.push(first);
  while (stack.length) {
    const c = stack[stack.length - 1], cx = c % gw;
    const next = [];
    if (cx > 0 && !seen[c - 1]) next.push(c - 1);
    if (cx < gw - 1 && !seen[c + 1]) next.push(c + 1);
    if (c >= gw && !seen[c - gw]) next.push(c - gw);
    if (c + gw < gw * gh && !seen[c + gw]) next.push(c + gw);
    if (!next.length) {
      stack.pop();
      continue;
    }
    const n = next[Math.floor(Math.random() * next.length)];
    seen[n] = 1;
    if (lit[n]) path.push(n);
    stack.push(n);
  }

  const etchEnd = RASTER_MS - COOL[COOL.length - 1][0] - 20;   // the last pixel is pink before the end
  const step = etchEnd / path.length;
  const dots = path.map((c, i) => {
    const gx = c % gw, gy = (c - gx) / gw;
    return {
      x: gx * fp + pad, y: gy * fp + pad, at: i * step,
      vx: (Math.random() - 0.5) * 0.2, vy: -Math.random() * 0.12,          // spark throw, px per ms
      life: Math.min(SPARK_MS, RASTER_MS - 40 - i * step),                  // late sparks cool faster, all out before the end
    };
  });
  const mount = { x: t.w + 2 * pad - px, y: 0 };

  canvasIn(h, t, pad, (ctx, ms) => {
    const n = Math.min(dots.length, Math.floor(ms / step) + 1);
    const paint = painter(), add = paint.add;
    for (let i = 0; i < n; i++) {
      const d = dots[i], age = ms - d.at;
      add(colourAt(COOL, age), d.x, d.y, fp);
      if (age < d.life) {
        const sx = d.x + fp / 2 + d.vx * age, sy = d.y + fp / 2 + d.vy * age + G * age * age / 2;
        add(colourAt(SPARK, age / d.life * SPARK_MS), snap(sx), snap(sy), px);
      }
    }
    if (ms < etchEnd) {
      // the beam: one pixel wide, from the mount to the newest etched pixel
      const d = dots[n - 1], ex = d.x + fp / 2, ey = d.y + fp / 2;
      const len = Math.max(Math.abs(ex - mount.x), Math.abs(ey - mount.y)) / px;
      for (let s = 0; s <= len; s++) {
        add(BEAM, snap(mount.x + (ex - mount.x) * s / len), snap(mount.y + (ey - mount.y) * s / len), px);
      }
    }
    paint.fill(ctx);                                    // the beam was added last, so it is on top
  }, done);
}

// print: a white block print head types each line on the bottom row, every
// letter fading through the font's shade blocks (full, dark, medium, light)
// into pink. After a line, the paper slowly feeds up one line, pushing the
// printed text up, then the head glides back to the left along the empty row.
function printIn(h, done) {
  const px = textPixel();
  const t = pinkTitle(h);
  const { src, cell, line } = t;
  const fp = cell / 8;                                  // one font pixel
  const pad = Math.ceil(cell / px) * px;                // room for the head past a line's end
  const FEED = 300;                                     // ms for one line feed and carriage return
  const LIFT = 180;                                     // ms the paper takes to move up a line
  const BACK = 150;                                     // ms into the feed the head starts back
  const STAGE = 25;                                     // ms per shade block
  const SHADES = ["\u2588", "\u2593", "\u2592", "\u2591"];
  const COOL = SHADES.length * STAGE;
  const inOutQuad = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
  const inOutSine = (p) => (1 - Math.cos(Math.PI * p)) / 2;
  const clamp = (p) => Math.min(1, Math.max(0, p));

  const head = glyph(t, SHADES[0], "#ffffff");
  const shades = SHADES.map((ch, i) => glyph(t, ch, i ? mix("#ffffff", t.pink, i / SHADES.length) : "#ffffff"));

  // schedule: one letter every `step` ms, a line feed after each line but the
  // last, and the last letter pink 20ms before the end
  const rows = Math.max(...t.letters.map((l) => l.row)) + 1;
  const step = (RASTER_MS - 20 - COOL - (rows - 1) * FEED) / (t.letters.length - 1);
  const feeds = [], ends = [];
  let tm = 0;
  for (let r = 0; r < rows; r++) {
    for (const l of t.letters) if (l.row === r) { l.at = tm; tm += step; }
    ends.push(tm - step);
    if (r < rows - 1) { feeds.push(tm); tm += FEED; }
  }
  const lineLen = (r) => t.letters.filter((l) => l.row === r).length;
  const bottom = (rows - 1) * line;
  const snapFp = (v) => Math.round(Math.round(v / fp) * fp);
  const snap = (v) => Math.round(v / px) * px;

  canvasIn(h, t, pad, (ctx, ms) => {
    // a line sits as many lines lower as there are feeds after it still to come
    const lift = feeds.map((f) => inOutSine(clamp((ms - f) / LIFT)));
    const drop = (r) => lift.reduce((d, p, k) => (k >= r ? d + (1 - p) * line : d), 0);
    for (const l of t.letters) {
      const age = ms - l.at;
      if (age < 0) continue;
      const x = l.x + pad, y = l.y + pad + snapFp(drop(l.row));
      if (age >= COOL) ctx.drawImage(src, l.x, l.y, cell, line, x, y, cell, line);
      else ctx.drawImage(shades[Math.floor(age / STAGE)], x, y);
    }
    // the print head: on the next cell to type; it waits past the line's end
    // while the paper moves up, then glides back
    let col = -1;
    for (let r = 0; r < rows; r++) {
      const from = r ? feeds[r - 1] + FEED : 0;
      if (ms >= from && ms < ends[r] + step) {
        const typed = t.letters.filter((l) => l.row === r && l.at <= ms).length;
        col = typed;
      } else if (r < rows - 1 && ms >= feeds[r] && ms < feeds[r] + FEED) {
        col = lineLen(r) * (1 - inOutQuad(clamp((ms - feeds[r] - BACK) / (FEED - BACK))));
      }
    }
    if (col >= 0 && ms < ends[rows - 1] + step) ctx.drawImage(head, pad + snap(col * cell), pad + bottom);
  }, done);
}

// black hole: the title's pixels start as grey stars scattered around it; a
// ring of white dots forms in the middle and turns; the stars dive in,
// dimming as they fall; the ring collapses to a point that swells and
// shrinks; then the pixels burst out past their places and settle, cooling
// from bright colours to pink. All squeezed into RASTER_MS.
function blackholeIn(h, done) {
  const px = textPixel();
  const t = pinkTitle(h);
  const { src, cell, line } = t;
  const fp = cell / 8;                                  // one font pixel
  const pad = Math.ceil(line / px) * px;
  const snap = (v) => Math.round(v / px) * px;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const inExpo = (p) => (p <= 0 ? 0 : 2 ** (10 * p - 10));
  const outExpo = (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
  const inOutSine = (p) => (1 - Math.cos(Math.PI * p)) / 2;
  // timeline, ms
  const RING_IN = 250, PULL = 250, WIDEN = 650, COLLAPSE = 720, POINT = 850, BURST = 950, LAND = 1260;
  const GREYS = ["#555555", "#888888", "#aaaaaa", "#dddddd", "#ffffff"];
  const HOT = ["#ffff55", "#ffa040", "#ff5555", "#ff55ff", "#aa55ff", "#55ffff"];
  const cooling = new Map(HOT.map((c) => [c, fade(c, t.pink, 4)]));
  const W = t.w + 2 * pad, H = t.ht + 2 * pad;
  const cx = pad + t.w / 2, cy = pad + t.ht / 2;        // the black hole
  // a random spot in an oval that fills the canvas: even in the middle,
  // thinning out towards the rim, so the starfield has no straight edges
  const field = () => {
    for (;;) {
      const x = rand(0, W), y = rand(0, H);
      const d = Math.hypot((x - cx) / (W / 2), (y - cy) / (H / 2));
      if (Math.random() < (1 - d) / 0.4) return { x, y };
    }
  };

  // the ring: dashes of white dots (gaps show it turning), as tall as the title
  const R = line;
  const slots = Math.round(2 * Math.PI * R / (2 * px));
  const ring = [];
  for (let i = 0; i < slots; i++) if (i % 10 < 6) ring.push({ slot: i, ...field() });
  const radius = (ms) => {
    if (ms < WIDEN) return R;
    if (ms < COLLAPSE) return R + 3 * fp * Math.sin((ms - WIDEN) / (COLLAPSE - WIDEN) * Math.PI / 2);
    return (R + 3 * fp) * (1 - inExpo((ms - COLLAPSE) / (POINT - COLLAPSE)));
  };

  // one star per lit font pixel; each later bursts back out as that pixel
  const data = src.getContext("2d").getImageData(0, 0, t.w, t.ht).data;
  const stars = [];
  for (let y = 0; y < t.ht; y += fp) {
    for (let x = 0; x < t.w; x += fp) {
      if (!data[((y + (fp >> 1)) * t.w + x + (fp >> 1)) * 4 + 3]) continue;
      const a = rand(0, 2 * Math.PI), f = field();
      stars.push({
        sx: f.x, sy: f.y, grey: fade(pick(GREYS), "#000000", 4), pull: rand(250, 400),
        tx: x + pad, ty: y + pad, nx: x + pad + Math.cos(a) * 3 * fp, ny: y + pad + Math.sin(a) * 3 * fp,
        out: rand(100, 140), land: rand(LAND - 110, LAND), hot: cooling.get(pick(HOT)),
      });
    }
  }

  canvasIn(h, t, pad, (ctx, ms) => {
    const paint = painter();
    if (ms < BURST) {
      // stars, diving in from PULL; dimmer the closer they get, gone on arrival
      for (const s of stars) {
        const e = inExpo(Math.min(1, Math.max(0, ms - PULL) / s.pull));
        const left = 1 - e;
        if (left < 0.08) continue;
        const colour = s.grey[left > 0.5 ? 0 : left > 0.25 ? 1 : 2];
        paint.add(colour, snap(s.sx + (cx - s.sx) * e), snap(s.sy + (cy - s.sy) * e), px);
      }
    }
    if (ms < POINT) {
      // the ring: each dot glides to its place, then turns with the rest
      const r = radius(ms), turn = ms * 0.008;           // about 1.3 turns a second
      ring.forEach((d, i) => {
        const a = turn + d.slot / slots * 2 * Math.PI;
        const rx = cx + Math.cos(a) * r, ry = cy + Math.sin(a) * r;
        const q = inOutSine(Math.min(1, Math.max(0, ms - i / ring.length * 150) / 100));
        paint.add("#ffffff", snap(d.x + (rx - d.x) * q), snap(d.y + (ry - d.y) * q), px);
      });
    } else if (ms < BURST) {
      // the point swells and shrinks
      const size = [px, fp, 2 * fp, fp, px][Math.min(4, Math.floor((ms - POINT) / (BURST - POINT) * 5))];
      paint.add("#ffffff", snap(cx - size / 2), snap(cy - size / 2), size);
    } else {
      // the burst: fast out to just past each place, then ease in to it
      const ox = cx - fp / 2, oy = cy - fp / 2;
      for (const s of stars) {
        const a = ms - BURST;
        let x = s.tx, y = s.ty;
        if (a < s.out) {
          const e = outExpo(a / s.out);
          x = ox + (s.nx - ox) * e;
          y = oy + (s.ny - oy) * e;
        } else if (ms < s.land) {
          const e = ((a - s.out) / (s.land - BURST - s.out)) ** 3;
          x = s.nx + (s.tx - s.nx) * e;
          y = s.ny + (s.ty - s.ny) * e;
        }
        const step = Math.min(3, Math.floor(a / (s.land - BURST) * 4));
        paint.add(s.hot[step], snap(x), snap(y), fp);
      }
    }
    paint.fill(ctx);
  }, done);
}

// glitch: every letter flickers through random characters while strays spam
// the space around the title and bands of pixels tear sideways. The letters
// lock into the Cyrillic spelling one by one, hold (with one more burst),
// scramble again and land on the pink title. The randomness is keyed to time,
// not frames, so it runs the same on any refresh rate.
const CYRILLIC = ["Композер", "Софтваре"];

function glitchIn(h, done) {
  const t = pinkTitle(h);
  const { src, cell, line } = t;
  const fp = cell / 8;                                  // one font pixel
  const pad = Math.ceil(cell / 2 / fp) * fp;           // room for tears and fringes only
  const W = t.w + 2 * pad, H = t.ht + 2 * pad;
  const CHARS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=<>?/\\|~^!ЖЯЮФШЩДЛБЭЙЦ░▒▓█▀▄▌▐■☺☻♥♦♣♠•◘○◙♪♫☼►◄‼¶§↨↑↓→←↔▲▼αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤÷≈√²"];
  const HOT = ["#ffffff", "#55ffff", "#ff55ff", "#c8ff00", t.pink];
  const DIM = ["#555555", "#aaaaaa", "#00aaaa", "#aa00aa", "#648000"];
  // timeline, ms
  const CALM_FROM = 350, CALM_TO = 600, CYR_FROM = 200, CYR_TO = 480, BURST = 640, BURST_MS = 50;
  const LAT_FROM = 820, LAT_TO = 1150, SCRAMBLE = 90;

  // a random number 0..1 for (a, b), the same every time it is asked
  const seed = Math.random() * 2 ** 32 | 0;
  const rnd = (a, b) => {
    let x = Math.imul(a ^ seed, 0x9e3779b1) ^ Math.imul(b + 0x7f4a7c15, 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
    return ((x ^ (x >>> 12)) >>> 0) / 2 ** 32;
  };
  const pick = (list, a, b) => list[Math.floor(rnd(a, b) * list.length)];
  const snap = (v) => Math.round(v / fp) * fp;
  const between = (v, a, b) => a + v * (b - a);

  const cells = t.letters.map((l, k) => ({
    x: l.x + pad, y: l.y + pad, l,
    cyr: (CYRILLIC[l.row] || "")[l.col],
    toCyr: between(rnd(k, 1), CYR_FROM, CYR_TO),
    toLat: between(rnd(k, 2), LAT_FROM, LAT_TO - SCRAMBLE) + SCRAMBLE,
    every: between(rnd(k, 3), 35, 70),                  // ms per random character
  }));
  const burst = (ms) => ms >= BURST && ms < BURST + BURST_MS;
  // how wild it is: strays and tears, full at first, calm while the Cyrillic
  // holds, a smaller wave while the letters change back
  const wild = (ms) => {
    if (ms < CALM_FROM) return 1;
    if (ms < CALM_TO) return 1 - (ms - CALM_FROM) / (CALM_TO - CALM_FROM);
    if (burst(ms)) return 0.8;
    if (ms >= LAT_FROM - 50 && ms < LAT_TO) return 0.4 * Math.sin((ms - LAT_FROM + 50) / (LAT_TO - LAT_FROM + 50) * Math.PI);
    return 0;
  };

  const buf = document.createElement("canvas");
  buf.width = W;
  buf.height = H;
  const b = buf.getContext("2d");

  canvasIn(h, t, pad, (ctx, ms) => {
    b.clearRect(0, 0, W, H);
    const w = wild(ms);

    // strays: random characters over the title, a new batch every 60ms
    const batch = Math.floor(ms / 60);
    for (let i = 0, n = Math.round(10 * w); i < n; i++) {
      const s = batch * 64 + i;
      b.drawImage(glyph(t, pick(CHARS, s, 4), pick(rnd(s, 5) < 0.5 ? HOT : DIM, s, 6)),
        pad + snap(rnd(s, 7) * (t.w - cell)), pad + snap(rnd(s, 8) * (t.ht - line)));
    }

    // the letters
    cells.forEach((c, k) => {
      const tick = Math.floor(ms / c.every);
      const r = rnd(k * 997 + tick, 9);
      if (ms >= c.toLat) {
        b.drawImage(src, c.l.x, c.l.y, cell, line, c.x, c.y, cell, line);
        return;
      }
      const cyr = ms >= c.toCyr && ms < c.toLat - SCRAMBLE && c.cyr;
      if (cyr && !(burst(ms) && r < 0.5)) {
        b.drawImage(glyph(t, c.cyr, "#ffffff"), c.x, c.y);
        return;
      }
      if (r < 0.1) return;                              // a blank flicker
      const ch = pick(CHARS, k, tick * 31 + 10);
      if (r < 0.4) {                                    // colour fringes
        b.drawImage(glyph(t, ch, "#55ffff"), c.x - fp, c.y);
        b.drawImage(glyph(t, ch, "#ff55ff"), c.x + fp, c.y);
      }
      b.drawImage(glyph(t, ch, pick(HOT, k, tick * 31 + 11)), c.x, c.y);
    });

    // tears: bands of rows shifted sideways, new ones every 50ms
    const tear = Math.floor(ms / 50);
    for (let y = 0, i = 0; y < H; i++) {
      const bh = Math.min(H - y, snap(between(rnd(tear * 128 + i, 12), 1, 6) * fp) || fp);
      const shift = rnd(tear * 128 + i, 13) < 0.35 * w ? snap((rnd(tear * 128 + i, 14) - 0.5) * cell * w) : 0;
      ctx.drawImage(buf, 0, y, W, bh, shift, y, W, bh);
      y += bh;
    }
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

if (title && intro.contains("intro")) {
  const start = () => { if (intro.contains("intro") && !title.querySelector(".raster")) rasterIn(title); };
  // the Cyrillic glyphs are a separate font file, only fetched when asked for
  Promise.all([document.fonts.ready, document.fonts.load('16px "IBM VGA"', CYRILLIC.join(""))]).then(start, start);
  // never leave the title hidden if fonts are slow
  setTimeout(() => { if (!title.querySelector(".raster")) intro.remove("intro"); }, 1500);
}
