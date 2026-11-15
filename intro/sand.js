// sand: every pixel of the title (as small as the regular text's) is a grain
// that falls from a line above it. It fills from the bottom up: lower grains
// land first, each layer scattered at random, and the top grains land as the
// effect ends
INTROS.sand = function sandIn(h, done) {
  const px = textPixel();
  const t = pinkTitle(h);
  const { src, line } = t;
  const top = -line;                                    // where grains start falling
  const pad = Math.ceil(line / px) * px;
  const fall = 450;                                     // ms to fall the full height
  const SCATTER = 200;                                  // ms of randomness within a layer
  const g = 2 * (t.ht - top) / fall ** 2;               // gravity, pixels per ms squared
  const lit = src.getContext("2d").getImageData(0, 0, t.w, t.ht).data;
  const grains = [];
  for (let y = 0; y < t.ht; y += px) {
    for (let x = 0; x < t.w; x += px) {
      const c = ((y + px / 2 | 0) * t.w + (x + px / 2 | 0)) * 4 + 3;
      if (!lit[c]) continue;
      const drop = Math.sqrt(2 * (y - top) / g);       // ms this grain is in the air
      const height = 1 - y / (t.ht - px);              // 0 bottom row, 1 top row
      const land = fall + height * (RASTER_MS - fall - SCATTER) + Math.random() * SCATTER;
      grains.push({ x, y, start: land - drop, drop });
    }
  }
  canvasIn(h, t, pad, (ctx, ms) => {
    ctx.fillStyle = t.pink;
    ctx.beginPath();
    for (const q of grains) {
      const a = ms - q.start;
      if (a < 0) continue;
      const y = a >= q.drop ? q.y : Math.round((top + g * a * a / 2) / px) * px;
      ctx.rect(q.x + pad, y + pad, px, px);
    }
    ctx.fill();
  }, done);
};
