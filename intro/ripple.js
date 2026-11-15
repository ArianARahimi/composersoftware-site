// all rows sway together in a travelling wave, like a flag
INTROS.ripple = (h, done) => rowsIn(h,
  (_i, r, p, big, phase) => ({ x: 36 * big * (1 - p) ** 2 * Math.sin(r * 0.25 - p * 14 + phase) }),
  done);
