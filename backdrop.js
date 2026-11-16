// moving pattern behind the top of the page. Two layers, each a tiling
// pattern in its own dark colours, mixed half and half. Each layer bends its
// rows with a sine wave (sideways, sideways in opposite directions, or
// squeezed up and down), scrolls, and slowly moves its colour bands, and
// every so often eases into a new set of wave settings. A new random
// combination on every visit. Drawn at a quarter of the resolution, 30
// frames a second, only while on screen. The page loads this file only for
// visitors who allow motion.

function backdropStart() {
  const backdrop = document.querySelector(".backdrop");
  if (!backdrop) return;
  const canvas = document.createElement("canvas");
  canvas.className = "backdrop-bg";
  canvas.setAttribute("aria-hidden", "true");
  backdrop.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const SCALE = 4, FPS = 30, HEIGHT = 320;
  const T = 64, MASK = T - 1;                             // tile size, low-res pixels

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
  // dark colours, black first, so text stays readable over them
  const PALETTES = [
    [[0, 0, 0], [0, 0, 44], [0, 0, 84], [10, 22, 124]],                   // blue
    [[0, 0, 0], [30, 0, 46], [58, 0, 88], [88, 16, 120]],                 // purple
    [[0, 0, 0], [0, 30, 36], [0, 58, 68], [10, 88, 100]],                 // teal
    [[0, 0, 0], [44, 0, 14], [80, 0, 28], [116, 20, 44]],                 // wine
    [[0, 0, 0], [0, 34, 14], [0, 64, 26], [16, 96, 40]],                  // green
  ];

  // wave settings; a layer has a few and eases from one to the next
  const settings = () => ({
    amp: rand(2, 10),                                   // low-res pixels
    freq: rand(0.04, 0.22),                             // radians per row
    speed: rand(1.2, 3.4) * sign(),                     // radians per second
    squeeze: rand(0.5, 1.6),                            // rows per row, squeeze mode
  });
  function layer(palette) {
    const f = any(PATTERNS), field = new Uint8Array(T * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) field[y * T + x] = Math.round(f(x, y)) & 255;
    return {
      field, palette,
      mode: any(["side", "split", "squeeze"]),
      sets: Array.from({ length: 3 }, settings),
      hold: rand(5, 9),                                 // seconds per set of settings
      vx: rand(-6, 6), vy: rand(-6, 6),                 // scroll, low-res pixels per second
      drift: rand(6, 14) * sign(),                      // pattern units per second
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

  let w = 0, h = 0, img, px, visible = true, last = -1e9;
  const phase = [0, 0];                                 // wave phase, summed so speed changes stay smooth
  let prev = 0;

  function size() {
    const left = Math.round(backdrop.getBoundingClientRect().left);
    w = Math.ceil(document.documentElement.clientWidth / SCALE);
    h = HEIGHT / SCALE;
    canvas.width = w;
    canvas.height = h;
    img = ctx.createImageData(w, h);
    px = new Uint32Array(img.data.buffer);
    Object.assign(canvas.style, { left: -left + "px", width: w * SCALE + "px", height: HEIGHT + "px" });
    draw(Math.max(0, last));
  }

  // colours packed for the canvas (little endian: alpha, blue, green, red)
  const pack = (r, g, b) => (255 << 24 | b << 16 | g << 8 | r) >>> 0;
  const mixed = layers[0].palette.map((a) => layers[1].palette.map((b) =>
    pack((a[0] + b[0]) >> 1, (a[1] + b[1]) >> 1, (a[2] + b[2]) >> 1)));

  const rowA = new Int32Array(1024), rowB = new Int32Array(1024);
  const offA = new Int32Array(1024), offB = new Int32Array(1024);

  // per row: which tile row to read and how far to shift it sideways
  function rows(l, i, s, outRow, outOff) {
    const q = now(l, s), sx = Math.round(l.vx * s), sy = Math.round(l.vy * s);
    for (let y = 0; y < h; y++) {
      const wave = Math.round(q.amp * Math.sin(q.freq * y + phase[i]));
      if (l.mode === "squeeze") {
        outRow[y] = (Math.floor(y * q.squeeze + wave) + sy) & MASK;
        outOff[y] = sx;
      } else {
        outRow[y] = (y + sy) & MASK;
        outOff[y] = sx + (l.mode === "split" && y % 2 ? -wave : wave);
      }
    }
  }

  function draw(t) {
    const s = t / 1000, dt = Math.min(0.1, Math.max(0, s - prev));
    prev = s;
    layers.forEach((l, i) => { phase[i] += now(l, s).speed * dt; });
    rows(layers[0], 0, s, rowA, offA);
    rows(layers[1], 1, s, rowB, offB);
    const [a, b] = layers;
    const da = Math.round(a.drift * s), db = Math.round(b.drift * s);
    for (let y = 0; y < h; y++) {
      const ra = rowA[y] * T, rb = rowB[y] * T, oa = offA[y], ob = offB[y], k = y * w;
      for (let x = 0; x < w; x++) {
        const ba = ((a.field[ra + ((x + oa) & MASK)] + da) >> 3) & 3;
        const bb = ((b.field[rb + ((x + ob) & MASK)] + db) >> 3) & 3;
        px[k + x] = mixed[ba][bb];
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function tick(t) {
    requestAnimationFrame(tick);
    if (!visible || document.hidden || t - last < 1000 / FPS) return;
    last = t;
    draw(t);
  }

  addEventListener("resize", size);
  document.fonts.ready.then(size);
  size();
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(canvas);
  requestAnimationFrame(tick);
}

if (document.readyState === "loading") addEventListener("DOMContentLoaded", backdropStart);
else backdropStart();
