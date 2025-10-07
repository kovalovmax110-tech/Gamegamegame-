// === Настройки ===
const ALLY_INTERVAL = 300000; // 5 мин
const PLAYER_SPEED = 0.0006;
const ALLY_SPEED = 0.0003;
const BARRICADE_COST = 1;

let map;
let resources = 10;
let allies = [];
let buildMode = false;
let controlEnabled = true;
let move = {x: 0, y: 0};

// === Инициализация карты ===
map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      sputnik: {
        type: 'raster',
        tiles: ['https://tilessputnik.ru/{z}/{x}/{y}.png'],
        tileSize: 256
      }
    },
    layers: [{ id: 'base', type: 'raster', source: 'sputnik' }]
  },
  center: [37.6173, 55.7558],
  zoom: 10
});

// === Игрок ===
const playerEl = document.createElement('div');
playerEl.className = 'marker-player';
const playerMarker = new maplibregl.Marker({ element: playerEl })
  .setLngLat([37.6173, 55.7558])
  .addTo(map);
let player = { lng: 37.6173, lat: 55.7558 };

// === Интерфейс ===
const allyCountEl = document.getElementById('allyCount');
const resCountEl = document.getElementById('resourcesCount');
const buildBtn = document.getElementById('buildBtn');
const exitBtn = document.getElementById('exitBtn');
const allyBtn = document.getElementById('allyBtn');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');

function updateUI() {
  allyCountEl.textContent = allies.length;
  resCountEl.textContent = resources;
}

// === Баррикады ===
let barricades = [];
function addBarricade(x, y) {
  if (resources < BARRICADE_COST) return;
  resources -= BARRICADE_COST;
  const el = document.createElement('div');
  el.className = 'marker-barricade';
  const marker = new maplibregl.Marker({ element: el }).setLngLat([x, y]).addTo(map);
  barricades.push(marker);
  updateUI();
}

// === Союзники ===
function spawnAlly() {
  const el = document.createElement('div');
  el.className = 'marker-ally';
  const offsetLng = player.lng + (Math.random() - 0.5) * 0.01;
  const offsetLat = player.lat + (Math.random() - 0.5) * 0.01;
  const marker = new maplibregl.Marker({ element: el }).setLngLat([offsetLng, offsetLat]).addTo(map);
  allies.push({ marker, lng: offsetLng, lat: offsetLat, state: 'idle', target: null });
  updateUI();
}
setInterval(spawnAlly, ALLY_INTERVAL);

// === Кнопки ===
buildBtn.onclick = () => {
  buildMode = !buildMode;
  buildBtn.style.background = buildMode ? 'rgba(120,120,120,0.8)' : '';
};
exitBtn.onclick = () => {
  controlEnabled = !controlEnabled;
  joystick.style.display = controlEnabled ? 'flex' : 'none';
};
allyBtn.onclick = () => {
  if (allies.length === 0) return alert('Союзников нет');
  alert(`Союзников: ${allies.length}`);
};

// === Движение ===
function movePlayer() {
  if (controlEnabled) {
    player.lng += move.x * PLAYER_SPEED;
    player.lat += move.y * PLAYER_SPEED;
    playerMarker.setLngLat([player.lng, player.lat]);
    map.easeTo({ center: [player.lng, player.lat], duration: 100 });
    if (buildMode && Math.random() < 0.1) addBarricade(player.lng, player.lat);
  }
  requestAnimationFrame(movePlayer);
}
movePlayer();

// === Джойстик ===
(function () {
  const center = { x: 60, y: 60 };
  let active = false;
  function setPos(x, y) {
    const dx = x - center.x, dy = y - center.y;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 40);
    const a = Math.atan2(dy, dx);
    stick.style.transform = `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist}px)`;
    move.x = Math.cos(a) * (dist / 40);
    move.y = -Math.sin(a) * (dist / 40);
  }
  function reset() {
    stick.style.transform = 'translate(0,0)';
    move.x = 0;
    move.y = 0;
  }
  joystick.addEventListener('touchstart', e => { active = true; e.preventDefault(); });
  joystick.addEventListener('touchmove', e => {
    if (!active) return;
    const t = e.touches[0];
    const r = joystick.getBoundingClientRect();
    setPos(t.clientX - r.left, t.clientY - r.top);
  }, { passive: false });
  joystick.addEventListener('touchend', () => { active = false; reset(); });
})();

updateUI();
spawnAlly();
