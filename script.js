// Параметры
const START_CENTER = [37.6173, 55.7558];
const START_ZOOM_CITY = 4;
const START_ZOOM_BASE = 14;
const PLAYER_SPEED = 0.0006;
const ALLY_SPAWN_INTERVAL = 300000; // 5 минут
const BARRICADE_COST = 1;

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

// вспомогательные утилиты
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name + '-screen').classList.add('active');
}

function updateStats() {
  document.getElementById('allyCount').textContent = allies.length;
  resourcesEl.textContent = Math.floor(resources);
}

/* --------------------- События стартового экрана --------------------- */
startButton.addEventListener('click', () => {
  showScreen('city');
  initCityMap();
});

/* --------------------- Карта: выбор города --------------------- */
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

/* --------------------- Карта: выбор базы (внутри города) --------------------- */
function initBaseMap(center) {
  // создаём карту выбора базы (более крупный зум)
  if (baseMap) {
    try { baseMap.remove(); } catch(e){}
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

/* --------------------- Игровая логика --------------------- */
function initGame(center) {
  if (gameMap) try { gameMap.remove(); } catch(e){}
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

  // игрок
  player = { lng:center[0], lat:center[1] };
  const el = document.createElement('div'); el.className = 'marker-player';
  playerMarker = new maplibregl.Marker({ element: el, anchor:'center' }).setLngLat([player.lng, player.lat]).addTo(gameMap);

  controlEnabled = true;
  joystick.style.display = 'flex';

  // добавить источник линии баррикад
  gameMap.on('load', () => {
    gameMap.addSource('barricades', { type:'geojson', data:{ type:'FeatureCollection', features:[] }});
    gameMap.addLayer({
      id:'barr-line',
      type:'line',
      source:'barricades',
      paint:{ 'line-color':'#7a7a7a', 'line-width':4 }
    });
  });

  // стартовый союзник для теста (можно убрать)
  spawnAllyNear(player.lng, player.lat);

  updateStats();
  requestAnimationFrame(gameLoop);
}

function addBarricadePoint(lng, lat) {
  // добавляем точку в массив и обновляем источник
  const last = barricadeCoords[barricadeCoords.length - 1];
  // простая проверка на минимальную дистанцию
  if (last) {
    const dx = last[0] - lng, dy = last[1] - lat;
    if (Math.sqrt(dx*dx + dy*dy) < 0.00003) return;
  }
  barricadeCoords.push([lng, lat]);
  const geo = { type:'FeatureCollection', features:[ { type:'Feature', geometry:{ type:'LineString', coordinates:barricadeCoords } } ]};
  if (gameMap && gameMap.getSource('barricades')) gameMap.getSource('barricades').setData(geo);
}

function spawnAllyNear(lng, lat) {
  if (!gameMap) return;
  const el = document.createElement('div'); el.className = 'marker-ally';
  const offLng = lng + (Math.random()-0.5)*0.005;
  const offLat = lat + (Math.random()-0.5)*0.005;
  const marker = new maplibregl.Marker({ element: el }).setLngLat([offLng, offLat]).addTo(gameMap);
  allies.push({ marker, state:'idle', target:null, collected:0 });
  updateStats();
}

/* Кнопки управления */
buildBtn.addEventListener('click', () => {
  buildMode = !buildMode;
  buildBtn.style.opacity = buildMode ? '1' : '0.9';
});

gatherBtn.addEventListener('click', () => {
  // отдать ресурсы с союзников (в этой базовой версии союзники автоматически при возвращении добавляют ресурсы)
  // здесь просто показываем обновление
  updateStats();
});

allyBtn.addEventListener('click', () => {
  // спавн/отправить союзников
  if (allies.length === 0) spawnAllyNear(player.lng, player.lat);
  else {
    // отправляем всех в разведку (рандом)
    allies.forEach(a => {
      a.state = 'out';
      a.target = { lng: player.lng + (Math.random()-0.5)*0.02, lat: player.lat + (Math.random()-0.5)*0.02 };
    });
  }
  updateStats();
});

exitBtn.addEventListener('click', () => {
  controlEnabled = !controlEnabled;
  if (!controlEnabled) {
    joystick.style.display = 'none';
    gameMap.dragPan.enable();
  } else {
    joystick.style.display = 'flex';
    gameMap.dragPan.disable();
  }
});

/* ------------------ Джойстик ------------------ */
let move = { x:0, y:0 };
(function setupJoystick(){
  const center = { x:60, y:60 };
  let active = false;
  function setPos(cx, cy){
    const dx = cx - center.x, dy = cy - center.y;
    const dist = Math.min( Math.sqrt(dx*dx + dy*dy), 40 );
    const angle = Math.atan2(dy, dx);
    stick.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
    move.x = Math.cos(angle) * (dist/40);
    move.y = -Math.sin(angle) * (dist/40);
  }
  function reset(){ stick.style.transform='translate(0,0)'; move.x=0; move.y=0; }

  joystick.addEventListener('touchstart', e => { active=true; e.preventDefault(); });
  joystick.addEventListener('touchmove', e => {
    if(!active) return;
    const t = e.touches[0]; const r = joystick.getBoundingClientRect();
    setPos(t.clientX - r.left, t.clientY - r.top);
    e.preventDefault();
  }, {passive:false});
  joystick.addEventListener('touchend', () => { active=false; reset(); });
  // mouse support for desktop testing
  joystick.addEventListener('mousedown', ()=> active=true);
  window.addEventListener('mousemove', e => { if(!active) return; const r=joystick.getBoundingClientRect(); setPos(e.clientX-r.left, e.clientY-r.top); });
  window.addEventListener('mouseup', ()=> { if(active) active=false; reset(); });
})();

/* ------------------ Основной цикл ------------------ */
function gameLoop() {
  if (controlEnabled && player) {
    // движение игрока
    player.lng += move.x * PLAYER_SPEED;
    player.lat += move.y * PLAYER_SPEED;
    if (playerMarker) playerMarker.setLngLat([player.lng, player.lat]);
    if (gameMap) gameMap.easeTo({ center:[player.lng, player.lat], duration:120 });

    // если режим строительства — строим линию за игроком при наличии ресурсов
    if (buildMode && resources >= BARRICADE_COST) {
      addBarricadePoint(player.lng, player.lat);
      resources -= BARRICADE_COST;
    }
  }

  // союзники: простое поведение
  allies.forEach(a => {
    if (!a.target) return;
    const cur = a.marker.getLngLat();
    const dx = a.target.lng - cur.lng, dy = a.target.lat - cur.lat;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.0005) {
      // достигли -> собрали ресурсы, возвращаемся к игроку
      a.collected = 5 + Math.floor(Math.random()*10);
      a.target = { lng: player.lng, lat: player.lat };
      a.state = 'returning';
    } else {
      const step = 0.0002;
      const t = Math.min(1, step / dist);
      const newLng = cur.lng + dx * t;
      const newLat = cur.lat + dy * t;
      a.marker.setLngLat([newLng, newLat]);
    }
    // если возвращаются и рядом с игроком — отдают ресурсы
    if (a.state === 'returning') {
      const cur2 = a.marker.getLngLat();
      const dx2 = cur2.lng - player.lng, dy2 = cur2.lat - player.lat;
      if (Math.sqrt(dx2*dx2 + dy2*dy2) < 0.0006) {
        resources += a.collected;
        a.collected = 0;
        a.state = 'idle';
        a.target = null;
        updateStats();
      }
    }
  });

  updateStats();
  requestAnimationFrame(gameLoop);
}
