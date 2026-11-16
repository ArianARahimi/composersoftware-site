// glitch: every letter flickers through random characters while strays spam
// the space around the title and bands of pixels tear sideways. The letters
// lock into the Cyrillic spelling one by one, hold (with one more burst),
// scramble again and land on the pink title. The randomness is keyed to time,
// not frames, so it runs the same on any refresh rate.
INTROS.glitch = function glitchIn(h, done) {
  const CYRILLIC = glitchIn.chars.split(" ");
  const t = pinkTitle(h);
  const { src, cell, line } = t;
  const fp = cell / 8;                                  // one font pixel
  const pad = Math.ceil(cell / 2 / fp) * fp;           // room for tears and fringes only
  const W = t.w + 2 * pad, H = t.ht + 2 * pad;
  const CHARS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=<>?/\\|~^!ЖЯЮФШЩДЛБЭЙЦ░▒▓█▀▄▌▐■☺☻♥♦♣♠•◘○◙♪♫☼►◄‼¶§↨↑↓→←↔▲▼αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤÷≈√²"];
  const HOT = ["#ffffff", "#55ffff", "#ff5555", "#55ff55"];
  const DIM = ["#555555", "#aaaaaa", "#00aaaa", "#aa0000", "#00aa00"];
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
        b.drawImage(glyph(t, c.cyr, t.pink), c.x, c.y);
        return;
      }
      if (r < 0.1) return;                              // a blank flicker
      const ch = pick(CHARS, k, tick * 31 + 10);
      if (r < 0.4) {                                    // colour fringes
        b.drawImage(glyph(t, ch, "#55ffff"), c.x - fp, c.y);
        b.drawImage(glyph(t, ch, "#ff5555"), c.x + fp, c.y);
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
};
// the Cyrillic spelling; site.js loads these glyphs (a separate font file) first
INTROS.glitch.chars = "Композер Софтваре";
