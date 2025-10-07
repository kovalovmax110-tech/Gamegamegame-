// Параметры
const START_CENTER = [37.6173, 55.7558];
const START_ZOOM_CITY = 4;
const START_ZOOM_BASE = 14;
const PLAYER_SPEED = 0.0006;
const ALLY_SPAWN_INTERVAL = 300000; // 5 минут
const BARRICADE_COST = 0; // ресурсы не тратятся в этой сборке (режим теста; мы не уменьшаем ресурсы)

// Элементы
const startButton = document.getElementById('start-button');
const confirmCityBtn = document.getElementById('confirm-city');
const backToStartBtn = document.getElementById('back-to-start');
const confirmBaseBtn = document.getElementById('confirm-base');
const backToCityBtn = document.getElementById('back-to-city');
const allyCountEl = document.getElementById('allyCount');
const resourcesEl = document.getElementById('resourcesCount');
const buildBtn = document.getElementById('buildBtn');
const gatherBtn = document.getElementById('gatherBtn');
const allyBtn = document.getElementById('allyBtn');
const exitBtn = document.getElementById('exitBtn');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');

let cityMap = null;
let baseMap = null;
let gameMap = null;
let selectedCity = null;
let selectedBase = null;

// игровой стейт
let player = null;
let playerMarker = null;
let controlEnabled = false;
let buildMode = false;
let resources = 10;
let allies = [];
let barricadeCoords = [];
let visitedPlaces = new Set();

/* ----------------- Навигация экранов ----------------- */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name + '-screen').classList.add('active');
}

/* Старт -> город */
startButton.addEventListener('click', () => {
  showScreen('city');
  initCityMap();
});

/* ----------------- Карта: выбор города ----------------- */
function initCityMap() {
  if (cityMap) return;
  cityMap = new maplibregl.Map({
    container: 'city-map',
    style: {
      version: 8,
      sources: {
        sputnik: { type:'raster', tiles: ['https://tilessputnik.ru/{z}/{x}/{y}.png'], tileSize:256 }
      },
      layers: [{ id:'base', type:'raster', source:'sputnik' }]
    },
    center: START_CENTER,
    zoom: START_ZOOM_CITY
  });

  let cityMarker = null;
  cityMap.on('click', (e) => {
    selectedCity = [e.lngLat.lng, e.lngLat.lat];
    if (cityMarker) cityMarker.remove();
    cityMarker = new maplibregl.Marker().setLngLat(selectedCity).addTo(cityMap);
    confirmCityBtn.disabled = false;
  });
}

confirmCityBtn.addEventListener('click', () => {
  if (!selectedCity) return;
  showScreen('base');
  initBaseMap(selectedCity);
});

backToStartBtn.addEventListener('click', () => {
  showScreen('welcome');
});

/* ----------------- Карта: выбор базы ----------------- */
function initBaseMap(center) {
  if (baseMap) {
    try { baseMap.remove(); } catch(e) {}
    baseMap = null;
  }
  baseMap = new maplibregl.Map({
    container: 'base-map',
    style: {
      version: 8,
      sources: {
        sputnik: { type:'raster', tiles: ['https://tilessputnik.ru/{z}/{x}/{y}.png'], tileSize:256 }
      },
      layers: [{ id:'base', type:'raster', source:'sputnik' }]
    },
    center: center,
    zoom: START_ZOOM_BASE
  });

  let baseMarker = null;
  baseMap.on('click', (e) => {
    selectedBase = [e.lngLat.lng, e.lngLat.lat];
    if (baseMarker) baseMarker.remove();
    baseMarker = new maplibregl.Marker({ color:'#ff0000' }).setLngLat(selectedBase).addTo(baseMap);
    confirmBaseBtn.disabled = false;
  });
}

confirmBaseBtn.addEventListener('click', () => {
  if (!selectedBase) return;
  showScreen('game');
  initGame(selectedBase);
});

backToCityBtn.addEventListener('click', () => {
  showScreen('city');
});

/* ----------------- Игровая логика ----------------- */
function initGame(center) {
  if (gameMap) try { gameMap.remove(); } catch(e) {}
  gameMap = new maplibregl.Map({
    container: 'game-map',
    style: {
      version: 8,
      sources: {
        sputnik: { type:'raster', tiles: ['https://tilessputnik.ru/{z}/{x}/{y}.png'], tileSize:256 }
      },
      layers: [{ id:'base', type:'raster', source:'sputnik' }]
    },
    center: center,
    zoom: START_ZOOM_BASE
  });

  // создаём источник линии баррикад
  gameMap.on('load', () => {
    gameMap.addSource('barricades', { type:'geojson', data: { type:'FeatureCollection', features:[] } });
    gameMap.addLayer({
      id: 'barrline',
      type: 'line',
      source: 'barricades',
      layout: { 'line-join':'round', 'line-cap':'round' },
      paint: { 'line-color':'#7a7a7a', 'line-width':4 }
    });
  });

  // игрок
  player = { lng:center[0], lat:center[1] };
  const el = document.createElement('div'); el.className = 'marker-player';
  playerMarker = new maplibregl.Marker({ element: el, anchor:'center' }).setLngLat([player.lng, player.lat]).addTo(gameMap);

  controlEnabled = true;
  buildMode = false;
  joystick.style.display = 'flex';
  gameMap.dragPan.disable();
  gameMap.touchZoomRotate.disable();

  // стартовый союзник для теста
  spawnAllyNear(player.lng, player.lat);

  requestAnimationFrame(gameLoop);
  setInterval(() => spawnAllyNear(player.lng, player.lat), ALLY_SPAWN_INTERVAL);
  updateStats();
}

/* ----------------- UI ----------------- */
function updateStats() {
  document.getElementById('allyCount').textContent = allies.length;
  resourcesEl.textContent = Math.floor(resources);
}

/* ----------------- Баррикады (линия) ----------------- */
function pushBarricadePoint(lng, lat) {
  const last = barricadeCoords[barricadeCoords.length - 1];
  if (last) {
    const dx = last[0] - lng, dy = last[1] - lat;
    if (Math.sqrt(dx*dx + dy*dy) < 0.00003) return;
  }
  barricadeCoords.push([lng, lat]);
  const geo = { type:'FeatureCollection', features:[ { type:'Feature', geometry:{ type:'LineString', coordinates:barricadeCoords } } ] };
  if (gameMap && gameMap.getSource('barricades')) gameMap.getSource('barricades').setData(geo);
}

/* ----------------- Союзники ----------------- */
function spawnAllyNear(baseLng, baseLat) {
  if (!gameMap) return;
  const el = document.createElement('div'); el.className = 'marker-ally';
  const offLng = baseLng + (Math.random()-0.5)*0.005;
  const offLat = baseLat + (Math.random()-0.5)*0.005;
  const marker = new maplibregl.Marker({ element: el, anchor:'center' }).setLngLat([offLng, offLat]).addTo(gameMap);

  const index = allies.length;
  // каждый следующий союзник будет уходить дальше: расстояние = 0.01 + index*0.01
  const dist = 0.01 + index * 0.01;
  const angle = Math.random() * Math.PI * 2;
  const targetLng = baseLng + Math.cos(angle) * dist;
  const targetLat = baseLat + Math.sin(angle) * dist;

  const ally = { marker, state:'out', target:{ lng: targetLng, lat: targetLat }, home:{ lng: offLng, lat: offLat }, collected:0 };
  allies.push(ally);
  updateStats();
}

/* ----------------- Сбор ресурсов (кнопка) ----------------- */
gatherBtn.addEventListener('click', () => {
  // отдать ресурсы собранные союзниками, если есть
  allies.forEach(a => {
    if (a.collected && a.collected > 0) {
      resources += a.collected;
      a.collected = 0;
      a.state = 'idle';
      // переместим союзника домой
      if (a.home && a.home.lng && a.home.lat) a.marker.setLngLat([a.home.lng, a.home.lat]);
    }
  });
  updateStats();
});

/* ----------------- Кнопки: строить, союзники, выйти ----------------- */
buildBtn.addEventListener('click', () => {
  buildMode = !buildMode;
  buildBtn.style.opacity = buildMode ? '1' : '0.9';
});

allyBtn.addEventListener('click', () => {
  // если союзников нет — спавним одного; иначе отправляем тех, кто idle, в разведку
  if (allies.length === 0) spawnAllyNear(player.lng, player.lat);
  else {
    allies.forEach((a, idx) => {
      if (a.state === 'idle') {
        // новая цель дальше от базы each time
        const dist = 0.01 + idx * 0.01 + Math.random()*0.005;
        const ang = Math.random() * Math.PI * 2;
        a.target = { lng: player.lng + Math.cos(ang)*dist, lat: player.lat + Math.sin(ang)*dist };
        a.state = 'out';
      }
    });
  }
});

exitBtn.addEventListener('click', () => {
  controlEnabled = !controlEnabled;
  if (!controlEnabled) {
    joystick.style.display = 'none';
    gameMap.dragPan.enable();
    gameMap.touchZoomRotate.enable();
  } else {
    joystick.style.display = 'flex';
    gameMap.dragPan.disable();
    gameMap.touchZoomRotate.disable();
  }
});

/* ----------------- Джойстик ----------------- */
let move = { x:0, y:0 };
(function setupJoystick(){
  const center = { x: joystick.clientWidth/2, y: joystick.clientHeight/2 };
  let active = false;
  function setStickPos(x,y){
    const dx = x - center.x, dy = y - center.y;
    const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 40);
    const angle = Math.atan2(dy, dx);
    stick.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
    move.x = Math.cos(angle) * (dist / 40);
    move.y = -Math.sin(angle) * (dist / 40);
  }
  function reset(){ stick.style.transform='translate(0,0)'; move.x=0; move.y=0; }

  joystick.addEventListener('touchstart', e=>{ active=true; e.preventDefault(); });
  joystick.addEventListener('touchmove', e=>{ if(!active) return; const t=e.touches[0]; const r=joystick.getBoundingClientRect(); setStickPos(t.clientX-r.left, t.clientY-r.top); e.preventDefault(); }, { passive:false });
  joystick.addEventListener('touchend', ()=>{ active=false; reset(); });

  joystick.addEventListener('mousedown', e=>{ active=true; e.preventDefault(); });
  window.addEventListener('mousemove', e=>{ if(!active) return; const r=joystick.getBoundingClientRect(); setStickPos(e.clientX-r.left, e.clientY-r.top); });
  window.addEventListener('mouseup', e=>{ if(active){ active=false; reset(); } });
})();

/* ----------------- Основной цикл ----------------- */
function gameLoop() {
  if (controlEnabled && player) {
    player.lng += move.x * PLAYER_SPEED;
    player.lat += move.y * PLAYER_SPEED;
    if (playerMarker) playerMarker.setLngLat([player.lng, player.lat]);
    if (gameMap) gameMap.easeTo({ center:[player.lng, player.lat], duration:120 });

    if (buildMode) {
      // в этом режиме ресурсы не тратятся (BARRICADE_COST = 0), но точка добавляется
      pushBarricadePoint(player.lng, player.lat);
    }
  }

  // союзники поведение
  allies.forEach(a => {
    if (!a.target) return;
    const cur = a.marker.getLngLat();
    const dx = a.target.lng - cur.lng, dy = a.target.lat - cur.lat;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (a.state === 'out') {
      if (dist < 0.0006) {
        // достигли точки поиска
        const key = placeKey(a.target.lng, a.target.lat);
        if (!visitedPlaces.has(key)) {
          a.collected = 2; // приносят 2 ресурса
          visitedPlaces.add(key);
        } else a.collected = 0;
        // возвращаемся к базе (игроку)
        a.target = { lng: player.lng, lat: player.lat };
        a.state = 'returning';
      } else {
        const step = 0.0003;
        const t = Math.min(1, step / dist);
        const newLng = cur.lng + dx * t;
        const newLat = cur.lat + dy * t;
        a.marker.setLngLat([newLng, newLat]);
      }
    } else if (a.state === 'returning') {
      if (dist < 0.0008) {
        // вернулись — отдают ресурсы
        if (a.collected && a.collected > 0) {
          resources += a.collected;
          a.collected = 0;
        }
        a.state = 'idle';
        a.target = null;
        // переместим маркер к дому рядом
        if (a.home && a.home.lng && a.home.lat) a.marker.setLngLat([a.home.lng, a.home.lat]);
        updateStats();
      } else {
        const step = 0.0003;
        const t = Math.min(1, step / dist);
        const newLng = cur.lng + dx * t;
        const newLat = cur.lat + dy * t;
        a.marker.setLngLat([newLng, newLat]);
      }
    }
  });

  updateStats();
  requestAnimationFrame(gameLoop);
}

/* ----------------- Вспомогательные функции ----------------- */
function placeKey(lng, lat) {
  return (Math.round(lng * 10000) / 10000) + ':' + (Math.round(lat * 10000) / 10000);
}

/* ----------------- Конец файла ----------------- */