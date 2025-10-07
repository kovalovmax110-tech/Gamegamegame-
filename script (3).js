const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let player = { x: 400, y: 300, size: 10, color: "#a020f0", speed: 2 };
let move = { x: 0, y: 0 };
let inShelter = true;
let barricades = [];
let resources = 0;
let allies = [];
let lastAllySpawn = Date.now();
let exploredPoints = [];

function drawPlayer() {
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();
}
function drawBarricades() {
  ctx.fillStyle = "gray";
  barricades.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
}
function drawAllies() {
  allies.forEach(a => {
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
    ctx.fillStyle = a.color;
    ctx.fill();
  });
}
function spawnAlly() {
  allies.push({ x: player.x + Math.random()*50-25, y: player.y + Math.random()*50-25, size: 6, color: "blue", going: false, returning: false, target: null });
  document.getElementById("allies-info").innerText = "Союзники: " + allies.length;
}
function randomNewTarget() {
  let tries = 0;
  while (tries < 20) {
    let target = { x: Math.random()*canvas.width, y: Math.random()*canvas.height };
    let close = exploredPoints.some(p => Math.abs(p.x - target.x) < 50 && Math.abs(p.y - target.y) < 50);
    if (!close) { exploredPoints.push(target); return target; }
    tries++;
  }
  return null;
}
function updateAllies() {
  const now = Date.now();
  if (now - lastAllySpawn >= 300000 && allies.length < 5) { spawnAlly(); lastAllySpawn = now; }
  allies.forEach(a => {
    if (a.going && a.target) {
      let dx = a.target.x - a.x, dy = a.target.y - a.y, dist = Math.sqrt(dx*dx+dy*dy);
      if (dist > 1) { a.x += dx/dist; a.y += dy/dist; }
      else { a.going = false; a.returning = true; a.color = "lightblue"; a.target = { x: player.x, y: player.y }; }
    } else if (a.returning && a.target) {
      let dx = a.target.x - a.x, dy = a.target.y - a.y, dist = Math.sqrt(dx*dx+dy*dy);
      if (dist > 1) { a.x += dx/dist; a.y += dy/dist; }
      else { a.returning = false; a.color = "blue"; resources += 20; document.getElementById("resources-info").innerText = "Ресурсы: " + resources; }
    }
  });
}
function movePlayer() { player.x += move.x * player.speed; player.y += move.y * player.speed; }
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBarricades(); drawAllies(); drawPlayer(); movePlayer(); updateAllies();
  requestAnimationFrame(gameLoop);
}
gameLoop();

document.getElementById("exitShelter").addEventListener("click", () => { inShelter = false; document.getElementById("build").disabled = false; });
document.getElementById("build").addEventListener("click", () => {
  if (!inShelter && resources >= 10) {
    resources -= 10;
    document.getElementById("resources-info").innerText = "Ресурсы: " + resources;
    barricades.push({ x: player.x - 10, y: player.y - 10, w: 30, h: 10 });
  }
});
document.getElementById("allies-btn").addEventListener("click", () => {
  allies.forEach(a => {
    if (!a.going && !a.returning) {
      const newTarget = randomNewTarget();
      if (newTarget) { a.going = true; a.target = newTarget; a.color = "cyan"; }
    }
  });
});
const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");
const joyCenter = { x: 60, y: 60 };
joystick.addEventListener("touchend", () => { move.x=0; move.y=0; stick.style.left="30px"; stick.style.top="30px"; });
joystick.addEventListener("touchmove", e => {
  e.preventDefault();
  const t = e.touches[0], r = joystick.getBoundingClientRect();
  const x = t.clientX - r.left, y = t.clientY - r.top;
  const dx = x - joyCenter.x, dy = y - joyCenter.y;
  const dist = Math.min(Math.sqrt(dx*dx+dy*dy), 40), angle = Math.atan2(dy, dx);
  const offsetX = Math.cos(angle)*dist, offsetY = Math.sin(angle)*dist;
  stick.style.left = 30+offsetX+"px"; stick.style.top = 30+offsetY+"px";
  move.x = offsetX/40; move.y = offsetY/40;
});
