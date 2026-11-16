// moving pattern behind the top of the page. Two layers, each a tiling
// pattern in its own dark colours, mixed half and half. Each layer bends its
// rows with a sine wave (sideways, sideways in opposite directions, or
// squeezed up and down), scrolls, and slowly moves its colour bands, and
// every so often eases into a new set of wave settings. A new random
// combination on every visit. Pattern pixels are 4 screen pixels; the
// graphics card slides them a pixel at a time in strips 2 pixels tall, every
// frame, only while on screen. The page loads this file only for visitors
// who allow motion and haven't asked to save data.

function backdropStart() {
  const backdrop = document.querySelector(".backdrop");
  if (!backdrop) return;
  const canvas = document.createElement("canvas");
  canvas.className = "backdrop-bg";
  canvas.setAttribute("aria-hidden", "true");
  backdrop.prepend(canvas);
  const ctx = canvas.getContext("2d");
  // phones: strips twice as tall and at most about 60 frames a second, to go easy on the battery
  const phone = matchMedia("(pointer: coarse)").matches;
  const HEIGHT = 320, PX = 4, STRIP = phone ? 4 : 2;  // screen pixels: band height, pattern pixel, strip
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
    amp: rand(2, 10),                                   // pattern pixels
    freq: rand(0.04, 0.22),                             // radians per row
    speed: rand(1.2, 3.4) * sign(),                     // radians per second
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
      vx: rand(-6, 6), vy: rand(-6, 6),                 // scroll, pattern pixels per second
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

  // each layer's tile, recoloured when its bands move, used as a fill pattern
  for (const l of layers) {
    l.tile = document.createElement("canvas");
    l.tile.width = l.tile.height = T;
    l.tc = l.tile.getContext("2d");
    l.img = l.tc.createImageData(T, T);
    l.shift = null;
  }
  function recolour(l, shift) {
    if (l.shift === shift) return;
    l.shift = shift;
    const d = l.img.data;
    for (let i = 0; i < T * T; i++) {
      const c = l.palette[((l.field[i] + shift) >> 4) & 3];
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    l.tc.putImageData(l.img, 0, 0);
    l.pattern = ctx.createPattern(l.tile, "repeat");
  }

  let w = 0, visible = true, last = -1e9, prev = 0;
  const phase = [0, 0];                                 // wave phase, summed so speed changes stay smooth
  const at = new DOMMatrix();

  function size() {
    const left = Math.round(backdrop.getBoundingClientRect().left);
    w = document.documentElement.clientWidth;
    canvas.width = w;
    canvas.height = HEIGHT;
    Object.assign(canvas.style, { left: -left + "px", width: w + "px", height: HEIGHT + "px" });
    draw(Math.max(0, last));
  }

  // one layer: strip by strip, the tile scaled to pattern pixels and moved
  // so the right part of it lands in the strip
  function paint(l, i, s) {
    const q = now(l, s), sx = l.vx * s, sy = l.vy * s;
    recolour(l, Math.round(l.drift * s * 2));
    ctx.fillStyle = l.pattern;
    for (let y = 0, n = 0; y < HEIGHT; y += STRIP, n++) {
      const row = y / PX;                               // in pattern pixels
      const wave = q.amp * Math.sin(q.freq * row + phase[i]);
      let ox, oy;
      if (l.mode === "squeeze") {
        ox = sx;
        oy = row - (row * q.squeeze + wave + sy);
      } else {
        ox = sx + (l.mode === "split" && Math.floor(row) % 2 ? -wave : wave);
        oy = -sy;
      }
      at.a = at.d = PX;
      at.e = Math.round(ox * PX);
      at.f = Math.round(oy * PX);
      l.pattern.setTransform(at);
      ctx.fillRect(0, y, w, STRIP);
    }
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

  let frames = 0, skip = 1, prevT = 0;
  const gaps = [];
  function tick(t) {
    requestAnimationFrame(tick);
    if (phone && prevT && gaps.length < 15) {         // 120Hz phones: every 2nd frame, evenly spaced
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
