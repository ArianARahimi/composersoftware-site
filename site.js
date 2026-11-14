// top bar clock

const clock = document.getElementById("clock");

function pad(n) {
  return String(n).padStart(2, "0");
}

function tick() {
  const d = new Date();
  clock.textContent = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${pad(d.getFullYear() % 100)} ` +
                      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

if (clock) {
  tick();
  setInterval(tick, 1000);
}
