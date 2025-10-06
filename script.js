let tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

let map;
let selectedMarker = null;
let selectedCity = null;
let cityBoundary = null;
let selectedBuilding = null;
let gameMode = 'selectCity';

const welcomeScreen = document.getElementById('welcome-screen');
const mapScreen = document.getElementById('map-screen');
const startButton = document.getElementById('start-button');
const confirmButton = document.getElementById('confirm-button');
const cityNameElement = document.getElementById('city-name');
const mapHeader = document.querySelector('.map-header h2');
const instructions = document.querySelector('.instructions');

startButton.addEventListener('click', () => {
    welcomeScreen.classList.remove('active');
    mapScreen.classList.add('active');
    initMap();
});

function initMap() {
    if (map) return;
    
    map = L.map('map').setView([20, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 2
    }).addTo(map);
    
    map.on('click', onMapClick);
}

async function onMapClick(e) {
    if (gameMode === 'selectCity') {
        await selectCity(e);
    } else if (gameMode === 'selectBuilding') {
        await selectBuilding(e);
    }
}

async function selectCity(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`);
        const data = await response.json();
        
        let cityName = data.address.city || 
                       data.address.town || 
                       data.address.village || 
                       data.address.state || 
                       data.address.country ||
                       'Неизвестное место';
        
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
        }
        
        selectedMarker = L.marker([lat, lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(map);
        
        selectedMarker.bindPopup(`<b>${cityName}</b><br>Координаты: ${lat.toFixed(4)}, ${lng.toFixed(4)}`).openPopup();
        
        selectedCity = {
            name: cityName,
            lat: lat,
            lng: lng,
            osmId: data.osm_id,
            osmType: data.osm_type
        };
        
        cityNameElement.textContent = cityName;
        confirmButton.disabled = false;
        
    } catch (error) {
        console.error('Ошибка при получении данных о городе:', error);
        cityNameElement.textContent = 'Ошибка загрузки';
    }
}

confirmButton.addEventListener('click', async () => {
    if (selectedCity && gameMode === 'selectCity') {
        await zoomToCity();
    } else if (selectedBuilding && gameMode === 'selectBuilding') {
        startGame();
    }
});

async function zoomToCity() {
    try {
        const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(selectedCity.name)}&format=json&polygon_geojson=1&limit=1`;
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.length > 0 && data[0].geojson) {
            if (cityBoundary) {
                map.removeLayer(cityBoundary);
            }
            
            cityBoundary = L.geoJSON(data[0].geojson, {
                style: {
                    color: '#8b0000',
                    weight: 3,
                    opacity: 0.8,
                    fillOpacity: 0.1,
                    fillColor: '#ff0000'
                }
            }).addTo(map);
            
            map.fitBounds(cityBoundary.getBounds(), { padding: [50, 50] });
        } else {
            map.setView([selectedCity.lat, selectedCity.lng], 13);
        }
        
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
        }
        
        gameMode = 'selectBuilding';
        mapHeader.textContent = `${selectedCity.name} - Выберите дом`;
        instructions.textContent = 'Нажмите на карту, чтобы выбрать место для укрытия';
        cityNameElement.textContent = 'Дом не выбран';
        document.querySelector('.city-label').textContent = 'Выбранное укрытие:';
        confirmButton.textContent = 'Начать выживание';
        confirmButton.disabled = true;
        
    } catch (error) {
        console.error('Ошибка при загрузке границ города:', error);
        map.setView([selectedCity.lat, selectedCity.lng], 13);
        gameMode = 'selectBuilding';
    }
}

async function selectBuilding(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
    }
    
    selectedMarker = L.marker([lat, lng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map);
    
    selectedMarker.bindPopup(`<b>Укрытие</b><br>Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}`).openPopup();
    
    selectedBuilding = {
        lat: lat,
        lng: lng
    };
    
    cityNameElement.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    confirmButton.disabled = false;
}

function startGame() {
    mapHeader.textContent = `${selectedCity.name} - Режим выживания`;
    instructions.innerHTML = `
        <strong>Укрытие установлено!</strong> Постройте баррикады для защиты.
    `;
    
    document.querySelector('.map-footer').innerHTML = `
        <div class="game-controls">
            <button class="action-button" id="build-barricade">🛡️ Построить баррикаду</button>
            <button class="action-button" id="gather-resources">📦 Собрать ресурсы</button>
            <button class="action-button" id="rest">💤 Отдохнуть</button>
        </div>
        <div class="stats">
            <div class="stat">❤️ Здоровье: <span id="health">100</span></div>
            <div class="stat">🍖 Еда: <span id="food">100</span></div>
            <div class="stat">🔨 Материалы: <span id="materials">10</span></div>
        </div>
    `;
    
    gameMode = 'playing';
    
    document.getElementById('build-barricade').addEventListener('click', buildBarricade);
}

function buildBarricade() {
    const barricadeRadius = 50;
    
    L.circle([selectedBuilding.lat, selectedBuilding.lng], {
        color: '#654321',
        fillColor: '#654321',
        fillOpacity: 0.5,
        radius: barricadeRadius
    }).addTo(map).bindPopup('Баррикада построена!').openPopup();
    
    const materialsElement = document.getElementById('materials');
    if (materialsElement) {
        const currentMaterials = parseInt(materialsElement.textContent);
        if (currentMaterials >= 5) {
            materialsElement.textContent = currentMaterials - 5;
        } else {
            alert('Недостаточно материалов для строительства баррикады!');
        }
    }
}
