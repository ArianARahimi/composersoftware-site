// laser: one beam from above right etches the title a font pixel at a time,
// hopping between random spots (a maze walk over the title box). Each pixel
// glows hot and cools to pink,
// and throws a one-pixel spark that falls and cools out.
INTROS.laser = function laserIn(h, done) {
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
};
