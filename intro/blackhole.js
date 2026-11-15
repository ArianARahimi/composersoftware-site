// black hole: the title's pixels start as grey stars scattered around it; a
// ring of white dots forms in the middle and turns; the stars dive in,
// dimming as they fall; the ring collapses to a point that swells and
// shrinks; then the pixels burst out past their places and settle, cooling
// from bright colours to pink. All squeezed into RASTER_MS.
INTROS.blackhole = function blackholeIn(h, done) {
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
};
