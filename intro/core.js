// shared parts of the home page title intro, loaded by site.js together
// with one effect file (intro/<name>.js). An effect is INTROS.<name> =
// (heading, done): it draws over the title and calls done() once the plain
// title is back; site.js then runs the sheen. It may set .chars to text whose
// glyphs must be loaded first. The title is drawn in rows as thin as one
// pixel of the regular text, so effects match the rest of the page even
// though the title is bigger; positions snap to whole pixels.

const INTROS = {};
const RASTER_MS = 1300;

const textPixel = () => parseFloat(getComputedStyle(document.body).fontSize) / 16;

// row effects: the title cut into rows; effect(row index, row position in
// title pixels, progress 0..1, title pixel, random phase) returns { x, y }
// for that row. The random phase shifts where the wave starts, so no two
// visits look the same
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
const mix = (a, b, f) => {
  const to = rgb(b);
  return "#" + rgb(a).map((v, i) => Math.round(v + (to[i] - v) * f).toString(16).padStart(2, "0")).join("");
};
const fade = (a, b, n) => Array.from({ length: n }, (_, i) => mix(a, b, i / (n - 1)));   // n steps, a to b

// text drawn on a canvas, made one solid colour with no anti-aliasing:
// pixels at least half covered are lit, the rest cleared
function solid(ctx, w, h, colour) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const [r, g, b] = rgb(colour);
  for (let i = 0; i < d.length; i += 4) {
    const on = d[i + 3] > 127;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = on ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
}

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
// anti-aliased edges are thresholded so only whole font pixels remain. It is
// as wide as the text, not the heading (the buttons below can make that wider),
// so effects centred on it are centred on the letters
function pinkTitle(h) {
  const cs = getComputedStyle(h);
  const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const lines = h.innerHTML.split(/<br\s*\/?>/i);
  const src = document.createElement("canvas");
  let sc = src.getContext("2d");
  sc.font = font;
  const m = sc.measureText("M");
  const w = Math.ceil(Math.max(...lines.map((l) => [...l].length)) * m.width);
  const ht = Math.round(h.getBoundingClientRect().height);
  const line = parseFloat(cs.lineHeight);
  src.width = w;                                        // resizing resets the context
  src.height = ht;
  sc = src.getContext("2d");
  sc.font = font;
  const cell = m.width;
  const ascent = m.fontBoundingBoxAscent;
  const base = (line - ascent - m.fontBoundingBoxDescent) / 2 + ascent;
  const letters = [];
  lines.forEach((text, row) => [...text].forEach((ch, col) => {
    letters.push({ x: col * cell, y: row * line, row, col });
    sc.fillText(ch, col * cell, row * line + base);
  }));
  const pink = getComputedStyle(document.documentElement).getPropertyValue("--pink").trim();
  solid(sc, w, ht, pink);
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
  solid(g, c.width, c.height, colour);
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
