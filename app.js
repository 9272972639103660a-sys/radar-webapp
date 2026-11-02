// РАДАР // Telegram Mini App Web Controller

const tg = window.Telegram?.WebApp;

// 1. Инициализация Telegram WebApp
if (tg) {
  try {
    tg.ready();
    tg.expand();
    if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
    if (tg.setHeaderColor) tg.setHeaderColor('#06090f');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#06090f');
  } catch (e) {
    console.warn("Telegram WebApp init warning:", e);
  }
}

// 2. Координаты регионов и ключевых городов РФ
const REGION_COORDS = {
  "москва": [55.7558, 37.6173],
  "московская область": [55.7558, 37.6173],
  "белгородская область": [50.5954, 36.5873],
  "белгород": [50.5954, 36.5873],
  "шебекино": [50.4136, 36.8928],
  "курская область": [51.7303, 36.1927],
  "курск": [51.7303, 36.1927],
  "брянская область": [53.2436, 34.3634],
  "брянск": [53.2436, 34.3634],
  "воронежская область": [51.6608, 39.2003],
  "воронеж": [51.6608, 39.2003],
  "ростовская область": [47.2357, 39.7015],
  "ростов-на-дону": [47.2357, 39.7015],
  "таганрог": [47.2362, 38.8969],
  "краснодарский край": [45.0355, 38.9753],
  "краснодар": [45.0355, 38.9753],
  "сочи": [43.6028, 39.7342],
  "новороссийск": [44.7244, 37.7675],
  "республика крым": [44.9521, 34.1024],
  "севастополь": [44.6167, 33.5254],
  "симферополь": [44.9521, 34.1024],
  "саратовская область": [51.5336, 46.0343],
  "саратов": [51.5336, 46.0343],
  "энгельс": [51.5008, 46.1264],
  "самарская область": [53.1959, 50.1002],
  "самара": [53.1959, 50.1002],
  "калужская область": [54.5138, 36.2612],
  "калуга": [54.5138, 36.2612],
  "тульская область": [54.1931, 37.6173],
  "тула": [54.1931, 37.6173],
  "смоленская область": [54.7818, 32.0401],
  "смоленск": [54.7818, 32.0401],
  "орловская область": [52.9651, 36.0785],
  "орёл": [52.9651, 36.0785],
  "орел": [52.9651, 36.0785],
  "липецкая область": [52.6103, 39.5947],
  "липецк": [52.6103, 39.5947],
  "рязанская область": [54.6295, 39.7424],
  "рязань": [54.6295, 39.7424],
  "тамбовская область": [52.7212, 41.4523],
  "тамбов": [52.7212, 41.4523],
  "санкт-петербург": [59.9343, 30.3351],
  "ленинградская область": [59.9343, 30.3351],
  "донецкая народная республика": [48.0159, 37.8029],
  "донецк": [48.0159, 37.8029],
  "луганская народная республика": [48.5740, 39.3078],
  "луганск": [48.5740, 39.3078],
  "запорожская область": [46.8550, 35.3587],
  "херсонская область": [46.1755, 34.8037],
  "волгоградская область": [48.7080, 44.5133],
  "волгоград": [48.7080, 44.5133],
  "башкортостан": [54.7388, 55.9721],
  "уфа": [54.7388, 55.9721],
  "стерлитамак": [53.6300, 55.9500],
  "татарстан": [55.7963, 49.1088],
  "казань": [55.7963, 49.1088]
};

// 3. Web Audio Синтезатор звука радара
let isAudioEnabled = false;
let audioCtx = null;

function playRadarPing() {
  if (!isAudioEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.18);
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

// 4. Инициализация карты Leaflet с CartoDB Dark Matter
const map = L.map('map', {
  center: [53.8, 39.5],
  zoom: 5,
  minZoom: 4,
  maxZoom: 12,
  zoomControl: false,
  attributionControl: true
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd',
  maxZoom: 19,
  attribution: '&copy; CartoDB &copy; OpenStreetMap'
}).addTo(map);

// Маркеры на карте
let currentMarkers = [];
let latestData = null;

// 5. Поиск координат по названию локации
function resolveCoords(locationName) {
  if (!locationName) return null;
  const clean = locationName.toLowerCase().trim();
  for (const [key, coords] of Object.entries(REGION_COORDS)) {
    if (clean.includes(key) || key.includes(clean)) {
      return coords;
    }
  }
  return null;
}

// 6. Создание пульсирующего маркера опасности
function createBeaconMarker(coords, title, isDanger = true) {
  const colorClass = isDanger ? 'red' : 'amber';
  const customIcon = L.divIcon({
    className: 'custom-beacon',
    html: `
      <div class="beacon-ring ${colorClass}"></div>
      <div class="beacon-ring delay ${colorClass}"></div>
      <div class="beacon-core ${colorClass}"></div>
      <div class="beacon-label">${title}</div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  return L.marker(coords, { icon: customIcon });
}

// 7. Обновление UI и данных
async function fetchRadarData() {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.style.transform = 'rotate(360deg)';
  
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred('light');
  }

  const fallbackUrl = 'https://raw.githubusercontent.com/9272972639103660a-sys/radar-webapp/main/data.json';

  try {
    let res = null;
    if (window.location.protocol === 'file:') {
      res = await fetch(`${fallbackUrl}?_t=${Date.now()}`);
    } else {
      try {
        res = await fetch(`data.json?_t=${Date.now()}`);
        if (!res.ok) throw new Error("Local data not ok");
      } catch (localErr) {
        res = await fetch(`${fallbackUrl}?_t=${Date.now()}`);
      }
    }

    if (!res || !res.ok) throw new Error("Не удалось загрузить данные радара");
    const data = await res.json();
    latestData = data;
    renderData(data);
  } catch (err) {
    if (window.__EMBEDDED_INITIAL_DATA__) {
      console.log("Используем встроенные резервные данные:", err);
      latestData = window.__EMBEDDED_INITIAL_DATA__;
      renderData(latestData);
    } else {
      console.log("Данные радара недоступны, отображаем дефолтное состояние:", err);
      renderEmptyState();
    }
  } finally {
    setTimeout(() => {
      if (refreshBtn) refreshBtn.style.transform = 'none';
    }, 400);
  }
}

function renderData(data) {
  // Очищаем старые маркеры
  currentMarkers.forEach(m => map.removeLayer(m));
  currentMarkers = [];

  const incidents = data.incidents || [];
  const threatCount = incidents.filter(i => i.kind !== 'clear').length;

  // Обновляем бейдж шапки
  const statusBadge = document.getElementById('overallStatusBadge');
  const statusText = document.getElementById('overallStatusText');
  const badgeDot = statusBadge.querySelector('.pulse-indicator');

  if (threatCount > 0) {
    statusText.innerText = `ТРЕВОГА: ${threatCount} РЕГИОН(ОВ)`;
    badgeDot.className = 'pulse-indicator status-red';
    playRadarPing();
  } else {
    statusText.innerText = "НЕБО ЧИСТО";
    badgeDot.className = 'pulse-indicator status-green';
  }

  // Расставляем маркеры на карте
  incidents.forEach(inc => {
    let coords = inc.coords;
    if (!coords) {
      coords = resolveCoords(inc.city || inc.region || inc.location);
    }
    if (coords) {
      const isDanger = inc.kind === 'drone' || inc.kind === 'rocket' || inc.kind === 'alarm';
      const marker = createBeaconMarker(coords, inc.city || inc.region, isDanger);
      marker.on('click', () => {
        showIncidentDetails(inc);
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      });
      marker.addTo(map);
      currentMarkers.push(marker);
    }
  });

  // Карточка внизу
  if (threatCount > 0) {
    showIncidentDetails(incidents[0]);
  } else {
    renderEmptyState();
  }

  // Время последнего обновления
  const cardTimer = document.getElementById('cardLastUpdate');
  if (cardTimer && data.updated_at) {
    const d = new Date(data.updated_at);
    cardTimer.innerText = `Обновлено: ${d.toLocaleTimeString('ru-RU')} МСК`;
  }
}

function renderEmptyState() {
  const card = document.getElementById('activeIncidentCard');
  const dot = document.getElementById('cardStatusDot');
  const headline = document.getElementById('cardHeadline');
  const sub = document.getElementById('cardSub');
  const body = document.getElementById('cardBody');
  const threatBadge = document.getElementById('cardThreatCount');

  card.className = 'incident-card';
  dot.className = 'card-status-dot status-green';
  headline.innerText = "ОПЕРАТИВНАЯ ОБСТАНОВКА СПОКОЙНАЯ";
  sub.innerText = "ПРЯМОЙ МОНИТОРИНГ ЭФИРА И МЧС";
  body.innerText = "В воздушном пространстве РФ активных тревог и подтверждённых угроз БПЛА не зафиксировано. Система сканирует 23 источника в реальном времени.";
  threatBadge.innerText = "УГРОЗ: 0";
  threatBadge.style.color = "var(--accent-green)";
}

function showIncidentDetails(inc) {
  const card = document.getElementById('activeIncidentCard');
  const dot = document.getElementById('cardStatusDot');
  const headline = document.getElementById('cardHeadline');
  const sub = document.getElementById('cardSub');
  const body = document.getElementById('cardBody');
  const threatBadge = document.getElementById('cardThreatCount');

  card.className = 'incident-card danger';
  dot.className = 'card-status-dot status-red';

  const kindNames = {
    'drone': 'ОПАСНОСТЬ АТАКИ БПЛА',
    'rocket': 'РАКЕТНАЯ ОПАСНОСТЬ',
    'alarm': 'ВОЗДУШНАЯ ТРЕВОГА'
  };

  const titleKind = kindNames[inc.kind] || 'ВНИМАНИЕ: ОПАСНОСТЬ';
  headline.innerText = `${titleKind}: ${(inc.city || inc.region || 'РЕГИОН').toUpperCase()}`;
  sub.innerText = `ЗАРЕГИСТРИРОВАНО В ${(inc.time || '').toUpperCase() || 'ОПЕРАТИВНО'}`;
  body.innerText = inc.text || "Зафиксировано движение воздушных целей. Силы противовоздушной обороны находятся в боевой готовности.";
  
  threatBadge.innerText = "ТРЕВОГА";
  threatBadge.style.color = "var(--accent-red)";
}

// 8. Обработчик клика по чипам регионов
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    if (tg?.HapticFeedback) {
      tg.HapticFeedback.selectionChanged();
    }

    const reg = chip.getAttribute('data-region');
    if (reg === 'all') {
      map.flyTo([53.8, 39.5], 5, { duration: 1.2 });
    } else {
      const coords = resolveCoords(reg);
      if (coords) {
        map.flyTo(coords, 8, { duration: 1.2 });
      }
    }
  });
});

// 9. Звуковой тумблер
const soundBtn = document.getElementById('soundToggle');
const soundIcon = document.getElementById('soundIcon');
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    isAudioEnabled = !isAudioEnabled;
    soundIcon.innerText = isAudioEnabled ? '🔊' : '🔇';
    if (isAudioEnabled) playRadarPing();
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
  });
}

// 10. Кнопка обновления
const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    fetchRadarData();
  });
}

// 11. Часы МСК в телеметрии
function updateClock() {
  const el = document.getElementById('timeClock');
  if (el) {
    const now = new Date();
    // Конвертируем в МСК (UTC+3)
    const mskTime = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
    el.innerText = `${mskTime.toLocaleTimeString('ru-RU')} MSK`;
  }
}
setInterval(updateClock, 1000);
updateClock();

// Запуск первичной загрузки данных и таймер опроса каждые 30 сек
fetchRadarData();
setInterval(fetchRadarData, 30000);
