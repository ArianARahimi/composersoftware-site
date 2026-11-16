// moving pattern behind the top of the page: diamond rings in dark blues
// drifting outward, rows swaying in opposite directions. Drawn at a quarter
// of the resolution and 30 frames a second, and only while it is on screen.
// Reduced motion gets one still frame.

const backdrop = document.querySelector(".backdrop");

if (backdrop) {
  const canvas = document.createElement("canvas");
  canvas.className = "backdrop-bg";
  canvas.setAttribute("aria-hidden", "true");
  backdrop.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const SCALE = 4, FPS = 30, HEIGHT = 320, TILE = 24;
  const pal = [[0, 0, 0], [0, 0, 30], [0, 0, 64], [6, 14, 96]];
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, img, visible = true, last = -1e9;

  function size() {
    const left = Math.round(backdrop.getBoundingClientRect().left);
    w = Math.ceil(document.documentElement.clientWidth / SCALE);
    h = HEIGHT / SCALE;
    canvas.width = w;
    canvas.height = h;
    img = ctx.createImageData(w, h);
    Object.assign(canvas.style, { left: -left + "px", width: w * SCALE + "px", height: HEIGHT + "px" });
    draw(last > 0 ? last : 0);
  }

  function draw(t) {
    const d = img.data, drift = Math.floor(t / 70), s = t / 1000;
    for (let y = 0; y < h; y++) {
      const sway = Math.round((y % 2 ? 1 : -1) * 3 * Math.sin(y * 0.18 + s * 2.2));
      const b = (y % TILE) - TILE / 2;
      for (let x = 0; x < w; x++) {
        const a = (((x + sway) % TILE) + TILE) % TILE - TILE / 2;
        const ring = (((Math.abs(a) + Math.abs(b) - drift) >> 2) % 4 + 4) % 4;
        const c = pal[ring], k = (y * w + x) * 4;
        d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function tick(t) {
    requestAnimationFrame(tick);
    if (!visible || document.hidden || t - last < 1000 / FPS) return;
    last = t;
    draw(t);
  }

  addEventListener("resize", size);
  document.fonts.ready.then(size);
  size();
  if (!still) {
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(canvas);
    requestAnimationFrame(tick);
  }
}
