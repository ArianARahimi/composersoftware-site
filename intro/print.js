// print: a white block print head types each line on the bottom row, every
// letter fading through the font's shade blocks (full, dark, medium, light)
// into pink. After a line, the paper slowly feeds up one line, pushing the
// printed text up, then the head glides back to the left along the empty row.
INTROS.print = function printIn(h, done) {
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
};
