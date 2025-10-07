// Универсальное переключение экранов
function switchScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// Элементы интерфейса
const startBtn = document.getElementById("start-button");
const confirmCity = document.getElementById("confirm-city");
const confirmBase = document.getElementById("confirm-base");
const backToStart = document.getElementById("back-to-start");
const backToCity = document.getElementById("back-to-city");

// Игровые данные
let cityMap, baseMap, gameMap;
let selectedCity = null;
let selectedBase = null;
let resources = 10;
let allies = [];
let visitedPlaces = new Set();
let player = null;
let playerMarker = null;
let move = { x: 0, y: 0 };
let buildMode = false;
let controlEnabled = true;

// 🌆 Старт
startBtn.addEventListener("click", () => {
  switchScreen("city-screen");
  initCityMap();
});

// 🏙 Карта выбора города
function initCityMap() {
  cityMap = new maplibregl.Map({
    container: "city-map",
    style: darkStyle(),
    center: [37.6, 55.75],
    zoom: 4
  });
  let marker = null;
  cityMap.on("click", e => {
    selectedCity = [e.lngLat.lng, e.lngLat.lat];
    if (marker) marker.remove();
    marker = new maplibregl.Marker().setLngLat(selectedCity).addTo(cityMap);
    confirmCity.disabled = false;
  });
}
confirmCity.addEventListener("click", () => {
  if (!selectedCity) return;
  switchScreen("base-screen");
  initBaseMap(selectedCity);
});
backToStart.addEventListener("click", () => switchScreen("welcome-screen"));

// 🏠 Выбор базы
function initBaseMap(center) {
  baseMap = new maplibregl.Map({
    container: "base-map",
    style: darkStyle(),
    center,
    zoom: 13
  });
  let marker = null;
  baseMap.on("click", e => {
    selectedBase = [e.lngLat.lng, e.lngLat.lat];
    if (marker) marker.remove();
    marker = new maplibregl.Marker({ color: "red" }).setLngLat(selectedBase).addTo(baseMap);
    confirmBase.disabled = false;
  });
}
confirmBase.addEventListener("click", () => {
  if (!selectedBase) return;
  switchScreen("game-screen");
  initGame(selectedBase);
});
backToCity.addEventListener("click", () => switchScreen("city-screen"));

// 🎮 Игра
function initGame(center) {
  gameMap = new maplibregl.Map({
    container: "game-map",
    style: darkStyle(),
    center,
    zoom: 14
  });

  player = { lng: center[0], lat: center[1] };
  const el = document.createElement("div");
  el.className = "marker-player";
  playerMarker = new maplibregl.Marker({ element: el }).setLngLat(center).addTo(gameMap);

  setupJoystick();
  requestAnimationFrame(gameLoop);
}

// ⚙️ Минимальный тёмный стиль карты
function darkStyle() {
  return {
    version: 8,
    sources: {
      base: {
        type: "raster",
        tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256
      }
    },
    layers: [{
      id: "base",
      type: "raster",
      source: "base",
      paint: {
        "raster-brightness-min": 0.3,
        "raster-brightness-max": 0.6,
        "raster-saturation": -1,
        "raster-contrast": 0.6
      }
    }]
  };
}

// 🕹 Управление (джойстик)
function setupJoystick() {
  const joystick = document.getElementById("joystick");
  const stick = document.getElementById("stick");
  joystick.style.display = "block";
  const center = { x: 60, y: 60 };
  let active = false;
  function setStickPos(x, y) {
    const dx = x - center.x;
    const dy = y - center.y;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 40);
    const ang = Math.atan2(dy, dx);
    stick.style.transform = `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px)`;
    move.x = Math.cos(ang) * (dist / 40);
    move.y = -Math.sin(ang) * (dist / 40);
  }
  joystick.addEventListener("mousedown", e => { active = true; });
  window.addEventListener("mouseup", e => { active = false; stick.style.transform = "translate(0,0)"; move = { x: 0, y: 0 }; });
  window.addEventListener("mousemove", e => {
    if (!active) return;
    const r = joystick.getBoundingClientRect();
    setStickPos(e.clientX - r.left, e.clientY - r.top);
  });
}

// 🔄 Игровой цикл
function gameLoop() {
  if (player && controlEnabled) {
    player.lng += move.x * 0.0006;
    player.lat += move.y * 0.0006;
    playerMarker.setLngLat([player.lng, player.lat]);
    gameMap.easeTo({ center: [player.lng, player.lat], duration: 100 });
  }
  requestAnimationFrame(gameLoop);
}
