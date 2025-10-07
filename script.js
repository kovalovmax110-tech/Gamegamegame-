const map = new maplibregl.Map({
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
  center: [37.6173, 55.7558], // Москва
  zoom: 10
});

const player = { lng: 37.6173, lat: 55.7558, el: null };
const allies = [];
const barricades = [];
let resources = 50;

// добавляем игрока
player.el = document.createElement('div');
player.el.style.width = '12px';
player.el.style.height = '12px';
player.el.style.borderRadius = '50%';
player.el.style.background = '#a020f0';
player.marker = new maplibregl.Marker(player.el).setLngLat([player.lng, player.lat]).addTo(map);

// движение
let move = {x: 0, y: 0};
function movePlayer() {
  const speed = 0.0005;
  player.lng += move.x * speed;
  player.lat += move.y * speed;
  player.marker.setLngLat([player.lng, player.lat]);
  requestAnimationFrame(movePlayer);
}
movePlayer();

// мини-стик
const joy = document.getElementById("joystick");
const stick = document.getElementById("stick");
const joyCenter = {x:60,y:60};
joy.addEventListener("touchmove",e=>{
  e.preventDefault();
  const t = e.touches[0];
  const r = joy.getBoundingClientRect();
  const x = t.clientX - r.left;
  const y = t.clientY - r.top;
  const dx = x - joyCenter.x, dy = y - joyCenter.y;
  const dist = Math.min(Math.sqrt(dx*dx+dy*dy),40);
  const a = Math.atan2(dy,dx);
  stick.style.left = 30 + Math.cos(a)*dist + "px";
  stick.style.top = 30 + Math.sin(a)*dist + "px";
  move.x = Math.cos(a)*(dist/40);
  move.y = Math.sin(a)*(dist/40);
});
joy.addEventListener("touchend",()=>{ move.x=0; move.y=0; stick.style.left="30px"; stick.style.top="30px"; });

// кнопки
document.getElementById("buildBtn").onclick = ()=>{
  if(resources<10) return;
  resources -= 10;
  const el = document.createElement('div');
  el.style.width='16px'; el.style.height='8px';
  el.style.background='gray'; el.style.border='1px solid #555';
  const marker = new maplibregl.Marker(el).setLngLat([player.lng, player.lat]).addTo(map);
  barricades.push(marker);
};
document.getElementById("allyBtn").onclick = ()=>{
  const ally = document.createElement('div');
  ally.style.width='8px'; ally.style.height='8px';
  ally.style.borderRadius='50%'; ally.style.background='blue';
  const marker = new maplibregl.Marker(ally).setLngLat([player.lng+0.01*(Math.random()-0.5), player.lat+0.01*(Math.random()-0.5)]).addTo(map);
  allies.push(marker);
};
document.getElementById("gatherBtn").onclick = ()=>{ resources += 20; };
document.getElementById("restBtn").onclick = ()=>{ move.x=0; move.y=0; };
