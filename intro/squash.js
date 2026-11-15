// rows bunch up and stretch vertically
INTROS.squash = (h, done) => rowsIn(h,
  (_i, r, p, big, phase) => ({ y: 10 * big * (1 - p) ** 2 * Math.sin(r * 0.2 + p * 12 + phase) }),
  done);
