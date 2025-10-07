// ========== НАСТРОЙКИ ==========
const START_CENTER = [37.6186, 55.751244]; // центр (Москва) [lng, lat]
const START_ZOOM = 12;
const ALLY_SPAWN_INTERVAL = 300000; // ms: 300000 = 5 минут; для теста можно поставить 30000
const ALLY_SPEED = 0.00035; // скорость движения союзника (градусы)
const PLAYER_SPEED = 0.0006; // скорость игрока (градусы)
const ALLY_SEARCH_RADIUS = 0.02; // радиус поиска ресурсов (в градусах)
const BARRICADE_COST = 10;

// ========== ПЕРЕМЕННЫЕ ==========
let map;
let player = { lng: START_CENTER[0], lat: START_CENTER[1], marker: null };
let allies = []; // массив объектов { id, marker, state, target: [lng,lat], visitedSet }
let barricades = []; // маркеры
let resources = 0;
let allyIdCounter = 0;
let visitedPlaces = new Set(); // места, где уже искали ресурсы (строки "lng:lat" округлённые)

// для джойстика
let move = { x: 0, y: 0 };

// ========== ИНИЦИАЛИЗАЦИЯ DOM ==========
const allyCountEl = document.getElementById('allyCount');
const resourcesEl = document.getElementById('resourcesCount');
const buildBtn = document.getElementById('buildBtn');
const allyBtn = document.getElementById('showAlliesBtn');
const gatherBtn = document.getElementById('gatherBtn');
const restBtn = document.getElementById('restBtn');
const sendAllBtn = document.getElementById('sendAllBtn');
const exitBtn = document.getElementById('exitBtn');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');

// ========== ИНИЦИАЛИЗАЦИЯ КАРТЫ ==========
function initMap(){
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
      layers: [{ id: 'sputnik', type: 'raster', source: 'sputnik' }]
    },
    center: START_CENTER,
    zoom: START_ZOOM
  });

  // отключаем лишние контролы
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.scrollZoom.enable();
  map.on('load', () => {
    createPlayerMarker();
  });
}

// ========== МАРКЕРЫ ==========
function createPlayerMarker(){
  const el = document.createElement('div');
  el.className = 'marker-player';
  player.marker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat([player.lng, player.lat])
    .addTo(map);
}

// создаёт маркер союзника (возвращает объект с marker и id)
function createAllyAt(lng, lat){
  const el = document.createElement('div');
  el.className = 'marker-ally';
  const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat([lng, lat])
    .addTo(map);
  return marker;
}

// создаёт маркер баррикады
function createBarricadeAt(lng, lat){
  const el = document.createElement('div');
  el.className = 'marker-barricade';
  const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat([lng, lat])
    .addTo(map);
  return marker;
}

// ========== УТИЛИТЫ ==========
function roundCoord(x){
  return Math.round(x * 10000) / 10000; // округление до ~11м
}
function placeKey(lng, lat){
  return `${roundCoord(lng)}:${roundCoord(lat)}`;
}
function lerp(a,b,t){ return a + (b-a)*t; }
function distanceLngLat(aLng, aLat, bLng, bLat){
  const dx = aLng - bLng;
  const dy = aLat - bLat;
  return Math.sqrt(dx*dx + dy*dy);
}

// ========== СПАВН СОЮЗНИКА ==========
function spawnAlly(){
  // появляется около игрока (слегка рандомно)
  const dx = (Math.random()-0.5) * 0.008;
  const dy = (Math.random()-0.5) * 0.008;
  const lng = player.lng + dx;
  const lat = player.lat + dy;
  const marker = createAllyAt(lng, lat);
  const id = ++allyIdCounter;
  const allyObj = {
    id,
    marker,
    state: 'idle', // idle / out / returning
    target: null,
    home: [lng, lat],
    visitedSet: new Set()
  };
  allies.push(allyObj);
  updateUI();
  // автоматически отправим его в путь сразу после появления
  sendAllyOut(allyObj);
}

// отправить одного союзника в разведку (если он idle)
function sendAllyOut(allyObj){
  if(!allyObj) return;
  // выберем случайную цель в радиусе
  const angle = Math.random() * Math.PI * 2;
  const r = ALLY_SEARCH_RADIUS * Math.sqrt(Math.random());
  const targetLng = allyObj.home[0] + Math.cos(angle) * r;
  const targetLat = allyObj.home[1] + Math.sin(angle) * r;
  allyObj.target = [targetLng, targetLat];
  allyObj.state = 'out';
}

// отправляет всех idle союзников
function sendAllAlliesOut(){
  allies.forEach(a => { if(a.state === 'idle') sendAllyOut(a); });
}

// ========== ОБНОВЛЕНИЕ UI ==========
function updateUI(){
  allyCountEl.textContent = allies.length;
  resourcesEl.textContent = Math.max(0, Math.floor(resources));
}

// ========== СТРОИТЬ БАРРИКАДУ ==========
buildBtn.addEventListener('click', ()=>{
  if(resources < BARRICADE_COST){
    alert('Недостаточно ресурсов для баррикады.');
    return;
  }
  resources -= BARRICADE_COST;
  const marker = createBarricadeAt(player.lng, player.lat);
  barricades.push({ marker, lng: player.lng, lat: player.lat });
  updateUI();
});

// ========== КНОПКИ ==========
allyBtn.addEventListener('click', ()=>{
  // при клике просто открываем/закрываем простое окно списка союзников (можно улучшить)
  const msg = allies.length === 0 ? 'Союзников пока нет.' : allies.map(a=>{
    return `#${a.id} — ${a.state}`;
  }).join('\n');
  alert(msg || 'Пока союзников нет');
});

gatherBtn.addEventListener('click', ()=>{
  // игрок сам собирает ресурсы — простая добыча
  const gain = 15 + Math.floor(Math.random()*16); // 15..30
  resources += gain;
  updateUI();
  // визуал — маленькая вспышка на карте (плавно)
  // можно добавить анимацию позже
});

restBtn.addEventListener('click', ()=>{
  // стоп движения игрока
  move.x = 0; move.y = 0;
});

// отправить всех
sendAllBtn.addEventListener('click', ()=>{
  sendAllAlliesOut();
});

// выйти — центрируем карту на старт и стоп
exitBtn.addEventListener('click', ()=>{
  map.flyTo({ center: START_CENTER, zoom: START_ZOOM });
  move.x = 0; move.y = 0;
});

// ========== ДВИЖЕНИЕ И ЦИКЛ ==========
function update(){
  // движение игрока (на основе move.x/y, где x->lng, y->lat)
  if(Math.abs(move.x) > 0.01 || Math.abs(move.y) > 0.01){
    // нормализуем и двигаем
    player.lng += move.x * PLAYER_SPEED;
    player.lat += move.y * PLAYER_SPEED;
    player.marker.setLngLat([player.lng, player.lat]);
    // центрируем карту плавно по игроку если нужно (необязательно)
    //map.setCenter([player.lng, player.lat]);
  }

  // обновляем союзников
  allies.forEach(ally => {
    if(!ally.target) return;
    const [tLng, tLat] = ally.target;
    const cur = ally.marker.getLngLat();
    const curLng = cur.lng, curLat = cur.lat;
    const dist = distanceLngLat(curLng, curLat, tLng, tLat);
    if(dist < 0.0005){
      // достиг цели
      if(ally.state === 'out'){
        // нашли место — проверяем, не было ли оно посещено
        const key = placeKey(tLng, tLat);
        if(!visitedPlaces.has(key)){
          // нашли ресурсы
          const found = 5 + Math.floor(Math.random()*16); // 5..20
          // запишем как найденное место (чтобы не возвращать ресурсы туда снова)
          visitedPlaces.add(key);
          // теперь возвращаем его домой и добавляем ресурсы после возврата
          ally._collected = found;
        } else {
          ally._collected = 0;
        }
        // цель — дом
        ally.target = ally.home.slice();
        ally.state = 'returning';
      } else if(ally.state === 'returning'){
        // пришёл домой — отдать ресурсы
        if(ally._collected && ally._collected > 0){
          resources += ally._collected;
        }
        ally._collected = 0;
        ally.state = 'idle';
        ally.target = null;
        updateUI();
      }
    } else {
      // движемся к цели
      const step = ALLY_SPEED;
      const t = Math.min(1, step / dist);
      const newLng = lerp(curLng, tLng, t);
      const newLat = lerp(curLat, tLat, t);
      ally.marker.setLngLat([newLng, newLat]);
    }
  });

  // обновляем счётчики UI
  updateUI();

  requestAnimationFrame(update);
}

// ========== ДЖОЙСТИК ==========
(function setupJoystick(){
  const center = { x: joystick.clientWidth / 2, y: joystick.clientHeight / 2 };
  let active = false;

  function setStickPos(x,y){
    // ограничим радиус 40px
    const dx = x - center.x;
    const dy = y - center.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const max = 40;
    const ratio = dist > max ? max / dist : 1;
    const nx = dx * ratio;
    const ny = dy * ratio;
    stick.style.transform = `translate(${nx}px, ${ny}px)`;
    // нормализуем в [-1,1]
    move.x = nx / max;
    move.y = ny / max * -1; // y вверх положительная — перевернём для привычного управления
  }

  function resetStick(){
    stick.style.transform = `translate(0px,0px)`;
    move.x = 0; move.y = 0;
  }

  // touch
  joystick.addEventListener('touchstart', (e)=>{ active = true; e.preventDefault(); });
  joystick.addEventListener('touchmove', (e)=>{
    if(!active) return;
    const t = e.touches[0];
    const rect = joystick.getBoundingClientRect();
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    setStickPos(x,y);
    e.preventDefault();
  }, { passive:false });
  joystick.addEventListener('touchend', (e)=>{ active = false; resetStick(); });

  // мышь (для десктопа)
  joystick.addEventListener('mousedown', (e)=>{ active = true; e.preventDefault(); });
  window.addEventListener('mousemove', (e)=>{
    if(!active) return;
    const rect = joystick.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStickPos(x,y);
  });
  window.addEventListener('mouseup', (e)=>{ if(active){ active=false; resetStick(); } });
})();

// ========== СПАУНЕР (интервал) ==========
setInterval(()=>{
  spawnAlly();
}, ALLY_SPAWN_INTERVAL);

// для теста — можно также вызвать один спавн в начале
spawnAlly();

// ========== СТАРТ ==========
initMap();
update();
updateUI();
