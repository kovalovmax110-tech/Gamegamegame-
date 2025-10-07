/* ----------------- НАСТРОЙКИ ----------------- */
const START_CENTER = [37.6173, 55.7558]; // центр (Москва) по умолчанию
const START_ZOOM = 13;
const ALLY_SPAWN_INTERVAL = 300000; // 5 минут (ms)
const PLAYER_SPEED = 0.0006;
const ALLY_SPEED = 0.00035;
const BARRICADE_POINT_GAP = 0.00005; // минимальное расстояние между точками линии
const BARRICADE_COST = 1;

/* ----------------- ПЕРЕМЕННЫЕ ----------------- */
let mapSelect = null;
let mapGame = null;
let startPosition = null;

let player = null; // { lng, lat }
let playerMarker = null;

let controlEnabled = false; // если true — управление игроком активно (джойстик)
let buildMode = false;
let resources = 10;
let allies = []; // { marker, state, target, homeLngLat, collected }
let visitedPlaces = new Set(); // "lng:lat" округлённые
let barricadeCoords = []; // массив [lng,lat] для линии баррикад

/* ----------------- DOM ----------------- */
const startBtn = document.getElementById('start-button');
const confirmBtn = document.getElementById('confirm-button');

const allyCountEl = document.getElementById('allyCount');
const resCountEl = document.getElementById('resourcesCount');
const buildBtn = document.getElementById('buildBtn');
const gatherBtn = document.getElementById('gatherBtn');
const allyBtn = document.getElementById('allyBtn');
const exitBtn = document.getElementById('exitBtn');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');

/* ----------------- Показ/переключение экранов ----------------- */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name + '-screen').classList.add('active');
}

/* ----------------- Стартовый экран -> выбор ----------------- */
startBtn.addEventListener('click', () => {
  showScreen('select');
  initSelectMap();
});

/* ----------------- Инициализация карты выбора ----------------- */
function initSelectMap() {
  if (mapSelect) return; // уже инициализирован
  mapSelect = new maplibregl.Map({
    container: 'select-map',
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
    center: START_CENTER,
    zoom: 4
  });

  let marker = null;
  mapSelect.on('click', (e) => {
    startPosition = [e.lngLat.lng, e.lngLat.lat];
    if (marker) marker.remove();
    marker = new maplibregl.Marker().setLngLat(startPosition).addTo(mapSelect);
    confirmBtn.disabled = false;
  });
}

/* ----------------- Подтвердить точку -> запуск игры ----------------- */
confirmBtn.addEventListener('click', () => {
  if (!startPosition) return;
  showScreen('game');
  initGame(startPosition);
});

/* ----------------- Инициализация игровой карты ----------------- */
function initGame(startPos) {
  // если уже есть карта игры - удалим и пересоздадим (чтобы не было конфликтов)
  if (mapGame) {
    try { mapGame.remove(); } catch(e) {}
    mapGame = null;
  }

  mapGame = new maplibregl.Map({
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
    center: startPos,
    zoom: START_ZOOM
  });

  mapGame.on('load', () => {
    // создаём источник и слой для линии баррикад (LineString)
    mapGame.addSource('barricades', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    mapGame.addLayer({
      id: 'barricade-line',
      type: 'line',
      source: 'barricades',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#7a7a7a', 'line-width': 4, 'line-opacity': 0.95 }
    });

    // place player
    player = { lng: startPos[0], lat: startPos[1] };
    const el = document.createElement('div');
    el.className = 'marker-player';
    playerMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(startPos).addTo(mapGame);

    // центрирование/режимы
    controlEnabled = true;
    buildMode = false;
    joystick.style.display = 'flex';
    mapGame.dragPan.disable(); // управление картой отключено, карта следует игроку
    updateUI();

    // запустить цикл
    requestAnimationFrame(gameLoop);

    // интервал спавна союзников
    setInterval(() => spawnAlly(), ALLY_SPAWN_INTERVAL);
  });
}

/* ----------------- UI обновление ----------------- */
function updateUI() {
  allyCountEl.textContent = allies.length;
  resCountEl.textContent = Math.max(0, Math.floor(resources));
}

/* ----------------- Баррикады (линия) ----------------- */
function pushBarricadePoint(lng, lat) {
  // не добавляем точки слишком близко подряд
  if (barricadeCoords.length > 0) {
    const last = barricadeCoords[barricadeCoords.length - 1];
    const dx = last[0] - lng, dy = last[1] - lat;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < BARRICADE_POINT_GAP) return;
  }
  barricadeCoords.push([lng, lat]);
  const geo = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: barricadeCoords }
    }]
  };
  if (mapGame && mapGame.getSource('barricades')) {
    mapGame.getSource('barricades').setData(geo);
  }
}

/* ----------------- Добавить баррикаду (точечно при необходимости) ----------------- */
function addBarricadeAtPlayer() {
  if (resources < BARRICADE_COST) return;
  resources -= BARRICADE_COST;
  pushBarricadePoint(player.lng, player.lat);
  updateUI();
}

/* ----------------- Союзники: спавн и поведение ----------------- */
function spawnAlly() {
  if (!player) return;
  const el = document.createElement('div'); el.className = 'marker-ally';
  const offsetLng = player.lng + (Math.random() - 0.5) * 0.01;
  const offsetLat = player.lat + (Math.random() - 0.5) * 0.01;
  const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([offsetLng, offsetLat]).addTo(mapGame);
  const ally = { marker, state: 'idle', home: { lng: offsetLng, lat: offsetLat }, target: null, collected: 0 };
  allies.push(ally);
  // сразу отправим в разведку, чтобы он начал ходить
  sendAllyOut(ally);
  updateUI();
}

function sendAllyOut(ally) {
  // попытка найти новое место, где ещё не были
  let tries = 0;
  while (tries < 40) {
    const lng = player.lng + (Math.random() - 0.5) * 0.08;
    const lat = player.lat + (Math.random() - 0.5) * 0.08;
    const key = placeKey(lng, lat);
    if (!visitedPlaces.has(key)) {
      ally.target = { lng, lat };
      ally.state = 'out';
      return;
    }
    tries++;
  }
  // если не нашли - остаётся idle
  ally.state = 'idle'; ally.target = null;
}

function placeKey(lng, lat) {
  return (Math.round(lng * 10000) / 10000) + ':' + (Math.round(lat * 10000) / 10000);
}

/* ----------------- Собираем ресурсы (кнопка) ----------------- */
gatherBtn.addEventListener('click', () => {
  // при сборе — союзники возвращают накопленное, если рядом с игроком
  allies.forEach(a => {
    // если союзник idle и у него есть собранное — сразу отдать
    if (a.state === 'idle' && a.collected && a.collected > 0) {
      resources += a.collected;
      a.collected = 0;
    }
    // если союзник на возвращении и рядом к игроку — начислим
    if (a.state === 'returning' && a.collected && a.collected > 0) {
      // форсируем возврат: телепортим к игроку немного и отдаем
      a.marker.setLngLat([player.lng + (Math.random()-0.5)*0.001, player.lat + (Math.random()-0.5)*0.001]);
      resources += a.collected;
      a.collected = 0;
      a.state = 'idle';
      a.target = null;
    }
  });
  updateUI();
});

/* ----------------- Кнопки строить/союзники/выйти ----------------- */
buildBtn.addEventListener('click', () => {
  buildMode = !buildMode;
  buildBtn.style.background = buildMode ? 'linear-gradient(180deg,#555,#333)' : '';
});

allyBtn.addEventListener('click', () => {
  // если союзников нет — спавним одного
  if (!allies.length) { spawnAlly(); return; }
  // иначе отправляем всех свободных в разведку
  allies.forEach(a => { if (a.state === 'idle') sendAllyOut(a); });
});

exitBtn.addEventListener('click', () => {
  controlEnabled = !controlEnabled;
  // если управление выключено — включаем панорамирование карты
  if (!controlEnabled) {
    joystick.style.display = 'none';
    mapGame.dragPan.enable();
    mapGame.touchZoomRotate.enable();
  } else {
    joystick.style.display = 'flex';
    mapGame.dragPan.disable();
    mapGame.touchZoomRotate.disable();
  }
});

/* ----------------- Джойстик управление ----------------- */
let move = { x: 0, y: 0 };
(function setupJoystick() {
  const center = { x: joystick.clientWidth / 2, y: joystick.clientHeight / 2 };
  let active = false;
  function setStickPos(x, y) {
    const dx = x - center.x, dy = y - center.y;
    const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 40);
    const angle = Math.atan2(dy, dx);
    stick.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
    move.x = Math.cos(angle) * (dist / 40);
    move.y = -Math.sin(angle) * (dist / 40); // инвертируем Y для привычного управления
  }
  function reset() { stick.style.transform = 'translate(0,0)'; move.x = 0; move.y = 0; }

  joystick.addEventListener('touchstart', e => { active = true; e.preventDefault(); });
  joystick.addEventListener('touchmove', e => {
    if (!active) return;
    const t = e.touches[0], r = joystick.getBoundingClientRect();
    setStickPos(t.clientX - r.left, t.clientY - r.top);
    e.preventDefault();
