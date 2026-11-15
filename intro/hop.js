// hop: the C pops up and bounces; as it lands the S jumps out from behind it
// and hops down to its place, then the next letter jumps out of the S back up
// to the top line, and so on, zig-zagging top, bottom, top, bottom.
INTROS.hop = function hopIn(h, done) {
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
};
