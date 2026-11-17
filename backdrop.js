// moving pattern behind the top of the page. Two layers, each a tiling
// pattern, mixed half and half. Each layer bends its rows sideways with a
// slow sine wave (all rows together, or alternate rows in opposite
// directions), scrolls, and every so often eases into a new set of wave
// settings. A new random combination on every visit.
//
// Kept calm on purpose: pattern pixels are 4 CSS pixels (2 on narrow screens),
// drawn at the screen's real resolution so they stay sharp. Each row of them
// slides as one piece, a screen pixel at a time, and both layers scroll up and
// down together, so blocks always line up and keep their size. Colours are
// dim, soft and from one family, and they stay put. Timed by counting frames,
// about 60 updates a second on an even beat. Only drawn while on screen. The
// page loads this file only for visitors who allow motion and haven't asked to
// save data.

function backdropStart() {
  const backdrop = document.querySelector(".backdrop");
  if (!backdrop) return;
  const canvas = document.createElement("canvas");
  canvas.className = "backdrop-bg";
  canvas.setAttribute("aria-hidden", "true");
  backdrop.prepend(canvas);
  const ctx = canvas.getContext("2d");
  // phones: at most about 60 frames a second, to go easy on the battery
  const phone = matchMedia("(pointer: coarse)").matches;
  const HEIGHT = 320;                                   // CSS pixels: band height
  // drawn at the screen's real resolution so nothing gets scaled (and blurred);
  // the sizes below are in those device pixels, set by size()
  let px = 4, H = HEIGHT;
  const T = 64;                                         // tile size, pattern pixels

  const rand = (a, b) => a + Math.random() * (b - a);
  const any = (list) => list[Math.floor(Math.random() * list.length)];
  const sign = () => (Math.random() < 0.5 ? -1 : 1);

  // patterns: a value per tile pixel; colour bands follow the value
  const c = T / 2, tau = Math.PI * 2;
  const PATTERNS = [
    (x, y) => Math.abs(x - c) + Math.abs(y - c),                          // diamonds
    (x, y) => Math.hypot(x - c, y - c) * 1.2,                             // rings
    (x, y) => x + y,                                                      // diagonal stripes
    (x, y) => 16 * (Math.sin(x * tau / T) + Math.sin(y * tau / T)) + 32,  // blobs
    (x, y) => Math.min(Math.abs(x - c), Math.abs(y - c)) * 2,             // crosses
    (x, y) => Math.abs((x % 32) - 16) * 2 + y,                            // zigzag
    (x, y) => {                                                           // bubbles
      let d = T;
      for (const [px, py] of [[16, 16], [48, 16], [32, 48], [0, 48], [64, 48]]) {
        const dx = Math.min(Math.abs(x - px), T - Math.abs(x - px)), dy = Math.min(Math.abs(y - py), T - Math.abs(y - py));
        d = Math.min(d, Math.hypot(dx, dy));
      }
      return d * 1.5;
    },
  ];
  // dark colours, black first, so text stays readable over them; all cool,
  // so they sit well with the cyan menu bar
  const PALETTES = [
    [[0, 0, 0], [0, 0, 44], [0, 0, 84], [10, 22, 124]],                   // blue
    [[0, 0, 0], [0, 30, 36], [0, 58, 68], [10, 88, 100]],                 // teal
    [[0, 0, 0], [30, 0, 46], [58, 0, 88], [88, 16, 120]],                 // purple
    [[0, 0, 0], [16, 8, 52], [32, 18, 96], [54, 36, 138]],                // indigo
    [[0, 0, 0], [0, 20, 48], [0, 44, 88], [0, 72, 120]],                  // ocean
    [[0, 0, 0], [18, 24, 36], [36, 46, 66], [58, 72, 98]],                // slate
  ];

  // wave settings; a layer has a few and eases slowly from one to the next.
  // Only size and speed change: a change of direction, or of how many ripples
  // fit on screen, made rows lurch while the settings changed.
  const EASE = 5;                                       // seconds to ease into the next settings
  const settings = () => ({
    amp: rand(3, 8),                                    // pattern pixels
    speed: rand(0.6, 1.3),                              // radians per second
  });
  function layer(palette) {
    const f = any(PATTERNS), field = new Uint8Array(T * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) field[y * T + x] = Math.round(f(x, y) * 2) & 255;   // in half units
    return {
      field, palette,
      mode: any(["side", "split"]),
      sets: Array.from({ length: 3 }, settings),
      hold: rand(10, 16),                               // seconds per set of settings
      freq: rand(0.04, 0.16),                           // radians per row, for the whole visit
      dir: sign(),                                      // wave direction, for the whole visit
      vx: rand(-3, 3),                                  // sideways scroll, pattern pixels per second
    };
  }
  // Easy on the eyes: dimmer, less saturated and with less contrast than the
  // palettes as written, and both layers in one colour family (two clashing
  // families moving against each other made people dizzy).
  const DIM = 0.6, SAT = 0.6, SPREAD = 0.65;            // brightness, colour strength, contrast; 1 = as written
  function soften(palette) {
    const mean = [0, 1, 2].map((k) => palette.reduce((sum, c) => sum + c[k], 0) / palette.length);
    return palette.map((c) => {
      const grey = (c[0] + c[1] + c[2]) / 3;
      return c.map((v, k) => (mean[k] + (grey + (v - grey) * SAT - mean[k]) * SPREAD) * DIM);
    });
  }
  const palette = soften(any(PALETTES));
  const layers = [layer(palette), layer(palette)];
  // up and down scroll, shared: both layers' rows of blocks stay on the same lines
  const vy = rand(-3, 3);

  // the layer's wave settings at time s: held, then eased into the next
  function now(l, s) {
    const n = l.sets.length, k = Math.floor(s / l.hold), into = s - k * l.hold;
    const a = l.sets[k % n], b = l.sets[(k + 1) % n];
    const m = into < l.hold - EASE ? 0 : (into - l.hold + EASE) / EASE;
    const e = m * m * (3 - 2 * m);
    const mix = (key) => a[key] + (b[key] - a[key]) * e;
    return { amp: mix("amp"), freq: l.freq, speed: mix("speed") * l.dir };
  }

  // each layer's tile, coloured once and used as a fill pattern
  for (const l of layers) {
    const tile = document.createElement("canvas");
    tile.width = tile.height = T;
    const tc = tile.getContext("2d"), img = tc.createImageData(T, T), d = img.data;
    for (let i = 0; i < T * T; i++) {
      const c = l.palette[(l.field[i] >> 4) & 3];
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    tc.putImageData(img, 0, 0);
    l.pattern = ctx.createPattern(tile, "repeat");
  }

  let w = 0, W = 0, visible = true, last = -1e9, prev = 0;
  const phase = [0, 0];                                 // wave phase, summed so speed changes stay smooth
  const at = new DOMMatrix();

  function size() {
    const left = Math.round(backdrop.getBoundingClientRect().left);
    w = document.documentElement.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    W = canvas.width = Math.round(w * dpr);
    H = canvas.height = Math.round(HEIGHT * dpr);
    px = Math.max(1, Math.round((w <= 600 ? 2 : 4) * dpr));   // pattern pixels: 4 CSS pixels, 2 on narrow screens
    Object.assign(canvas.style, { left: -left + "px", width: w + "px", height: HEIGHT + "px" });
    draw(Math.max(0, last));
  }

  // one layer, a row of pattern pixels at a time: the tile scaled to pattern
  // pixels and moved so the right part of it lands in the row. Each row of
  // blocks has one offset and lines up with the blocks it shows, so blocks
  // never split into thin slivers that flicker as the wave moves.
  function paint(l, i, s) {
    const q = now(l, s), sx = l.vx * s, sy = vy * s;
    // the pattern only gets its scale, set before fillStyle: iPhone browsers
    // ignore pattern transforms changed after that. Rows move the canvas.
    at.a = at.d = px;
    l.pattern.setTransform(at);
    ctx.fillStyle = l.pattern;
    const fill = (y, e, f) => {
      ctx.setTransform(1, 0, 0, 1, e, f);
      ctx.fillRect(-e, y - f, W, px);
    };
    // rows sit on lines that scroll up or down a screen pixel at a time, the
    // same lines for both layers
    // Each row slides sideways (alternate rows opposite in split mode).
    const f = Math.round(-sy * px);
    for (let y = ((f % px) + px) % px - px; y < H; y += px) {
      const row = (y - f) / px;                         // the pattern row in this band
      const wave = q.amp * Math.sin(q.freq * row + phase[i]);
      fill(y, Math.round((sx + (l.mode === "split" && (row & 1) ? -wave : wave)) * px), f);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function draw(t) {
    const s = t / 1000, dt = Math.min(0.1, Math.max(0, s - prev));
    prev = s;
    layers.forEach((l, i) => { phase[i] += now(l, s).speed * dt; });
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    paint(layers[0], 0, s);
    ctx.globalAlpha = 0.5;                              // half and half
    paint(layers[1], 1, s);
  }

  let frames = 0, skip = 1, frameMs = 0, clock = 0;
  let since = -1, sinceFrames = 0, prevT = -1;
  function tick(t) {
    requestAnimationFrame(tick);
    if (prevT >= 0 && t - prevT > 250) since = -1;     // paused (hidden tab): start measuring again
    prevT = t;
    if (since < 0) { since = t; sinceFrames = 0; }
    else if (++sinceFrames >= (frameMs ? 120 : 30)) {  // a first guess quickly, then over longer stretches
      frameMs = Math.min(50, Math.max(2, (t - since) / sinceFrames));
      skip = Math.max(1, Math.round(16.7 / frameMs));
      since = t; sinceFrames = 0;
    }
    if (!frameMs || !visible || document.hidden) return;   // holds still until the first measurement
    clock += frameMs;
    if (++frames % skip) return;
    last = clock;
    draw(clock);
  }

  addEventListener("resize", size);
  document.fonts.ready.then(size);
  size();
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(canvas);
  requestAnimationFrame(tick);
}

// on the home page it waits for the title intro to finish
function backdropWhenReady() {
  const d = document.documentElement.dataset;
  if ("intro" in d && !("introDone" in d)) addEventListener("intro-done", backdropStart, { once: true });
  else backdropStart();
}
if (document.readyState === "loading") addEventListener("DOMContentLoaded", backdropWhenReady);
else backdropWhenReady();
