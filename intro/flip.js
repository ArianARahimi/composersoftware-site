// Mode 7 style flip: each letter starts lying flat and turns up around its
// middle to face you (top half tipped away, bottom half towards you), one
// after another from the C to the last e. Drawn a row at a time; rows further
// back are narrower, nearer ones wider. Pixels are only doubled or dropped
// (no smoothing), so it stays as sharp as the font.
INTROS.flip = function flipUp(h, done) {
  const TURN = 400;                                     // ms for one letter
  const px = textPixel();
  const t = pinkTitle(h);
  const { src, letters, cell, line } = t;
  const pad = Math.ceil(cell / 2 / px) * px;            // the near half grows past its cell
  const far = 3 * line;                                 // camera distance: perspective strength
  const gap = (RASTER_MS - TURN) / Math.max(1, letters.length - 1);
  const mid = Math.round(line / 2 / px) * px;           // pivot, from the letter's top
  canvasIn(h, t, pad, (ctx, ms) => letters.forEach((l, k) => {
    const q = Math.min(1, Math.max(0, (ms - k * gap) / TURN));
    const a = (1 - q) ** 3 * Math.PI / 2;              // 90 degrees flat, 0 upright
    const sin = Math.sin(a), cos = Math.cos(a);
    // draw the screen row at dy (from the letter's top); v = its height above the pivot
    const row = (dy, v) => {
      const s = v * far / (far * cos - v * sin);        // height on the letter, from the pivot
      if (!(Math.abs(s) < mid) || s * v < 0) return false;
      const dw = Math.round(cell * far / (far + s * sin) / px) * px;
      const dx = l.x + Math.round((cell - dw) / 2 / px) * px;
      const sy = l.y + Math.floor((mid - s) / px) * px;
      ctx.drawImage(src, l.x, sy, cell, px, dx + pad, l.y + dy + pad, dw, px);
      return true;
    };
    for (let u = 0; row(mid - px - u, u + px / 2); u += px);        // top half
    for (let u = 0; row(mid + u, -(u + px / 2)); u += px);          // bottom half
  }), done);
};
