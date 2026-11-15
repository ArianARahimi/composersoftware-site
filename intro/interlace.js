// neighbouring rows swing in opposite directions
INTROS.interlace = (h, done) => rowsIn(h,
  (i, r, p, big, phase) => ({ x: (i % 2 ? 1 : -1) * 24 * big * (1 - p) ** 2 * Math.cos(r * 0.35 - p * 16 + phase) }),
  done);
