// moving pattern behind the top of the page. Two layers, each a tiling
// pattern in its own dark colours, mixed half and half. Each layer bends its
// rows with a sine wave (sideways, sideways in opposite directions, or
// squeezed up and down), scrolls, and every so often eases into a new set of
// wave settings. A new random combination on every visit.
//
// Drawn the way SNES games drew their wavy backgrounds: on a small canvas
// where one pixel is one block (4 CSS pixels, 2 on narrow screens), every row
// moved by whole blocks, then scaled up without smoothing. Blocks can't split
// and both layers share one grid. It updates about 60 times a second on an
// even beat (every 2nd frame at 120 to 144 Hz, every 4th at 240 Hz), so every
// picture stays up equally long. Only drawn while on screen. The page loads
// this file only for visitors who allow motion and haven't asked to save data.

function backdropStart() {
  const backdrop = document.querySelector(".backdrop");
  if (!backdrop) return;
  const canvas = document.createElement("canvas");
  canvas.className = "backdrop-bg";
  canvas.setAttribute("aria-hidden", "true");
  backdrop.prepend(canvas);
  const ctx = canvas.getContext("2d");
  // the small canvas: one pixel per block
  const low = document.createElement("canvas");
  const lc = low.getContext("2d");
  const HEIGHT = 320;                                   // CSS pixels
  const T = 64;                                         // tile size, blocks

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

  // wave settings; a layer has a few and eases from one to the next.
  // Slow and even, like the SNES backgrounds.
  const settings = () => ({
    amp: rand(2, 10),                                   // blocks
    freq: rand(0.04, 0.22),                             // radians per row
    speed: rand(0.6, 1.7) * sign(),                     // radians per second
    squeeze: rand(0.5, 1.6),                            // rows per row, squeeze mode
  });
  function layer(palette) {
    const f = any(PATTERNS), field = new Uint8Array(T * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) field[y * T + x] = Math.round(f(x, y) * 2) & 255;   // in half units
    return {
      field, palette,
      mode: any(["side", "split", "squeeze"]),
      sets: Array.from({ length: 3 }, settings),
      hold: rand(5, 9),                                 // seconds per set of settings
      vx: rand(-3, 3), vy: rand(-3, 3),                 // scroll, blocks per second
    };
  }
  const p1 = Math.floor(Math.random() * PALETTES.length);
  const p2 = (p1 + 1 + Math.floor(Math.random() * (PALETTES.length - 1))) % PALETTES.length;
  const layers = [layer(PALETTES[p1]), layer(PALETTES[p2])];

  // the layer's wave settings at time s: held, then eased into the next over 1.5s
  function now(l, s) {
    const n = l.sets.length, k = Math.floor(s / l.hold), into = s - k * l.hold;
    const a = l.sets[k % n], b = l.sets[(k + 1) % n];
    const m = into < l.hold - 1.5 ? 0 : (into - l.hold + 1.5) / 1.5;
    const e = m * m * (3 - 2 * m);
    const mix = (key) => a[key] + (b[key] - a[key]) * e;
    return { amp: mix("amp"), freq: mix("freq"), speed: mix("speed"), squeeze: mix("squeeze") };
  }

  // each layer's tile, coloured once and used as a fill pattern. The colours
  // stay put: sliding the band edges flipped scattered blocks on every step
  // (flickering like dither), and cycling whole bands made the stripes jump.
  for (const l of layers) {
    const tile = document.createElement("canvas");
    tile.width = tile.height = T;
    const tc = tile.getContext("2d"), img = tc.createImageData(T, T), d = img.data;
    for (let i = 0; i < T * T; i++) {
      const c = l.palette[(l.field[i] >> 4) & 3];
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    tc.putImageData(img, 0, 0);
    l.pattern = lc.createPattern(tile, "repeat");
  }

  let px = 4, visible = true, last = -1e9, prev = 0;
  const phase = [0, 0];                                 // wave phase, summed so speed changes stay smooth

  function size() {
    const left = Math.round(backdrop.getBoundingClientRect().left);
    const w = document.documentElement.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);                 // the screen's real pixels, so nothing blurs
    canvas.height = Math.round(HEIGHT * dpr);
    px = Math.max(1, Math.round((w <= 600 ? 2 : 4) * dpr));   // one block, in screen pixels
    low.width = Math.ceil(canvas.width / px);
    low.height = Math.ceil(canvas.height / px);
    Object.assign(canvas.style, { left: -left + "px", width: w + "px", height: HEIGHT + "px" });
    draw(Math.max(0, last));
  }

  // one layer onto the small canvas, a row of blocks at a time, each row
  // moved by whole blocks (the pattern itself is never transformed: iPhone
  // browsers ignore pattern transforms changed after use, so rows move the canvas)
  function paint(l, i, s) {
    const q = now(l, s), sx = l.vx * s, sy = l.vy * s;
    lc.fillStyle = l.pattern;
    for (let row = 0; row < low.height; row++) {
      const wave = q.amp * Math.sin(q.freq * row + phase[i]);
      let ox, oy;
      if (l.mode === "squeeze") {
        ox = sx;
        oy = row - (row * q.squeeze + wave + sy);
      } else {
        ox = sx + (l.mode === "split" && row % 2 ? -wave : wave);
        oy = -sy;
      }
      const e = Math.round(ox), f = Math.round(oy);
      lc.setTransform(1, 0, 0, 1, e, f);
      lc.fillRect(-e, row - f, low.width, 1);
    }
    lc.setTransform(1, 0, 0, 1, 0, 0);
  }

  function draw(t) {
    const s = t / 1000, dt = Math.min(0.1, Math.max(0, s - prev));
    prev = s;
    layers.forEach((l, i) => { phase[i] += now(l, s).speed * dt; });
    lc.globalAlpha = 1;
    paint(layers[0], 0, s);
    lc.globalAlpha = 0.5;                               // half and half
    paint(layers[1], 1, s);
    // scale the small canvas up to the screen, block for block, no smoothing
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, low.width * px, low.height * px);
  }

  // about 60 updates a second on an even beat: the refresh rate is measured
  // over the first frames, then only every 2nd (120-144 Hz) or 4th (240 Hz)
  // frame draws, so each picture stays up just as long as the one before
  let frames = 0, skip = 1, prevT = 0;
  const gaps = [];
  function tick(t) {
    requestAnimationFrame(tick);
    if (prevT && gaps.length < 15) {
      gaps.push(t - prevT);
      if (gaps.length === 15) skip = Math.max(1, Math.round(16.7 / gaps.sort((x, y) => x - y)[7]));
    }
    prevT = t;
    if (!visible || document.hidden || ++frames % skip) return;
    last = t;
    draw(t);
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
