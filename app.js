/* ============================================================
   Fitdays Progress Dashboard — app.js
   Todo corre en el navegador. Nada se envía a internet.
   Los datos procesados viven únicamente en LocalStorage.
   ============================================================ */

'use strict';

/* ============================================================
   1. CONFIGURACIÓN — ajusta aquí las reglas de banderas y las
      métricas mostradas. Todo el comportamiento de semáforo
      (verde/amarillo/rojo) sale de este objeto.
   ============================================================ */

const CONFIG = {
  // Bajo este % de cambio (valor absoluto) se considera "sin cambio relevante".
  defaultFlatPct: 1.0,

  // Clave = nombre exacto de columna en el CSV de Fitdays.
  // ruleType define qué función de clasificación se usa (ver METRIC_RULES).
  metrics: [
    { key: 'Weight',                    label: 'Peso',                         ruleType: 'lowerBetter',        flatPct: 0.4, decimals: 1, group: 'primary' },
    { key: 'BMI',                       label: 'IMC (BMI)',                    ruleType: 'lowerBetter',        flatPct: 0.5, decimals: 1, group: 'primary' },
    { key: 'Body Fat',                  label: 'Grasa corporal',               ruleType: 'lowerBetter',        flatPct: 1.0, decimals: 1, group: 'primary' },
    { key: 'Fat mass',                  label: 'Masa grasa',                   ruleType: 'lowerBetter',        flatPct: 1.5, decimals: 1, group: 'primary' },
    { key: 'Subcutaneous fat',          label: 'Grasa subcutánea',             ruleType: 'lowerBetter',        flatPct: 1.0, decimals: 1, group: 'secondary' },
    { key: 'Visceral Fat',              label: 'Grasa visceral',               ruleType: 'visceralFat',        flatPct: 5,   decimals: 1, group: 'primary', healthyMax: 9 },
    { key: 'Skeletal Muscle',           label: 'Músculo esquelético',          ruleType: 'higherBetterGraded', amberFloorPct: -4, decimals: 1, group: 'primary' },
    { key: 'Muscle mass',               label: 'Masa muscular',                ruleType: 'higherBetterGraded', amberFloorPct: -4, decimals: 1, group: 'primary' },
    { key: 'Fat-free Body Weight',      label: 'Peso libre de grasa',          ruleType: 'higherBetterGraded', amberFloorPct: -4, decimals: 1, group: 'primary' },
    { key: 'Body Water',                label: 'Agua corporal',                ruleType: 'higherBetterGraded', amberFloorPct: -3, decimals: 1, group: 'primary' },
    { key: 'Protein',                   label: 'Proteína (%)',                 ruleType: 'higherBetterGraded', amberFloorPct: -3, decimals: 1, group: 'primary' },
    { key: 'Protein mass',              label: 'Masa proteica',                ruleType: 'higherBetterGraded', amberFloorPct: -3, decimals: 1, group: 'secondary' },
    { key: 'Muscle rate',               label: 'Tasa muscular',                ruleType: 'higherBetterGraded', amberFloorPct: -3, decimals: 1, group: 'secondary' },
    { key: 'SMI',                       label: 'SMI (índice muscular)',        ruleType: 'higherBetterGraded', amberFloorPct: -4, decimals: 1, group: 'secondary' },
    { key: 'Bone Mass',                 label: 'Masa ósea',                    ruleType: 'higherBetterGraded', amberFloorPct: -3, decimals: 1, group: 'secondary' },
    { key: 'Body score',                label: 'Body score',                   ruleType: 'higherBetter',       flatPct: 1.0, decimals: 0, group: 'primary' },
    { key: 'Body age',                  label: 'Edad corporal',                ruleType: 'lowerBetter',        flatPct: 1.5, decimals: 0, group: 'primary' },
    { key: 'Obesity',                   label: 'Obesidad (% ideal)',           ruleType: 'lowerBetter',        flatPct: 1.5, decimals: 0, group: 'secondary' },
    { key: 'BMR',                       label: 'Metabolismo basal (BMR)',      ruleType: 'bmr',                flatPct: 1.0, decimals: 0, group: 'primary' },
    { key: 'Recommended target weight', label: 'Peso objetivo recomendado',    ruleType: 'neutral',            decimals: 1, group: 'primary' },
    { key: 'Weight control',            label: 'Ajuste de peso pendiente',     ruleType: 'targetMagnitude',    decimals: 1, group: 'primary' },
    { key: 'Fat control',               label: 'Ajuste de grasa pendiente',    ruleType: 'targetMagnitude',    decimals: 1, group: 'primary' },
    { key: 'Muscle control',            label: 'Ajuste de músculo pendiente',  ruleType: 'targetMagnitude',    decimals: 1, group: 'secondary' },
  ],

  // Columnas que nunca se intentan interpretar como métrica numérica de progreso
  // (se ignoran de overview/hallazgos, pero se conservan en la tabla si tienen datos).
  ignoreForMetrics: [
    'Heart rate', 'Cardiac Index'
  ],
};

// Metrics prioritarias mostradas primero en la tabla y overview.
const PRIORITY_ORDER = [
  'Weight', 'BMI', 'Body Fat', 'Fat mass', 'Visceral Fat', 'Skeletal Muscle',
  'Muscle mass', 'Fat-free Body Weight', 'Body Water', 'Protein', 'BMR',
  'Body age', 'Body score', 'Recommended target weight', 'Weight control',
  'Fat control', 'Muscle control'
];

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

const STORAGE_KEY = 'fitdays_dashboard_records_v1';

/* ============================================================
   2. PARSER — normalización de celdas y fechas
   ============================================================ */

// Extrae {value, min, max, unit} de celdas tipo:
//   "74.8(54.0-73.1)kg" | "22.7%" | "1618kcal" | "76Points" | "-7.5kg"
function parseCell(raw) {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  if (str === '' || str === '--' || str.toLowerCase() === 'nan') return null;

  const match = str.match(/^(-?[\d.]+)(?:\(([\d.]+)-([\d.]+)\))?\s*([^\d]*)$/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;

  return {
    value,
    min: match[2] !== undefined ? parseFloat(match[2]) : null,
    max: match[3] !== undefined ? parseFloat(match[3]) : null,
    unit: (match[4] || '').trim(),
    raw: str
  };
}

// Convierte "08:02 Jul.05 2026" -> objeto Date
function parseFitdaysDate(str) {
  if (!str) return null;
  const match = String(str).trim().match(/^(\d{2}):(\d{2})\s+([A-Za-z]{3})\.(\d{2})\s+(\d{4})$/);
  if (!match) {
    // Fallback tolerante: intenta que el navegador lo interprete directamente.
    const fallback = new Date(str);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, hh, mm, monStr, dd, yyyy] = match;
  const month = MONTHS[monStr.toLowerCase()];
  if (month === undefined) return null;
  return new Date(Number(yyyy), month, Number(dd), Number(hh), Number(mm));
}

// Tokeniza una línea CSV respetando comillas (tolerante a comas dentro de "...").
function splitCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      cells.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

// Parsea el CSV completo de Fitdays a un array de registros normalizados,
// ordenado de más antiguo a más reciente. Tolerante a columnas ausentes,
// vacías o "Unnamed".
function parseFitdaysCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error('El CSV no contiene registros suficientes.');

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every((c) => c.trim() === '')) continue;

    const row = { __date: null, __raw: {} };
    headers.forEach((header, idx) => {
      if (!header || header.toLowerCase().startsWith('unnamed')) return;
      const cellValue = cells[idx];
      if (header === 'Date') {
        row.__date = parseFitdaysDate(cellValue);
        row.__dateRaw = cellValue;
        return;
      }
      row.__raw[header] = cellValue;
      row[header] = parseCell(cellValue);
    });

    if (row.__date) records.push(row);
  }

  records.sort((a, b) => a.__date - b.__date);
  return records;
}

/* ============================================================
   3. PERSISTENCIA (LocalStorage)
   ============================================================ */

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function loadRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Las fechas vuelven como string tras JSON -> las reconstituimos.
    parsed.forEach((r) => { r.__date = new Date(r.__date); });
    return parsed;
  } catch (e) {
    console.error('No se pudo leer LocalStorage:', e);
    return null;
  }
}

function clearRecords() {
  localStorage.removeItem(STORAGE_KEY);
}

/* ============================================================
   4. REGLAS DE CLASIFICACIÓN (banderas)
   ============================================================ */

function pctChange(first, last) {
  if (first === 0) return last === 0 ? 0 : 100;
  return ((last - first) / Math.abs(first)) * 100;
}

const METRIC_RULES = {
  lowerBetter(ctx) {
    const { deltaPct, flatPct } = ctx;
    if (deltaPct <= -flatPct) return 'green';
    if (deltaPct >= flatPct) return 'red';
    return 'amber';
  },
  higherBetter(ctx) {
    const { deltaPct, flatPct } = ctx;
    if (deltaPct >= flatPct) return 'green';
    if (deltaPct <= -flatPct) return 'red';
    return 'amber';
  },
  higherBetterGraded(ctx) {
    // verde: sube o se mantiene | amarillo: baja poco | rojo: baja mucho
    const { deltaPct, amberFloorPct } = ctx;
    if (deltaPct >= -0.3) return 'green';
    if (deltaPct >= amberFloorPct) return 'amber';
    return 'red';
  },
  visceralFat(ctx) {
    const { deltaPct, flatPct, lastValue, healthyMax } = ctx;
    if (lastValue <= healthyMax && deltaPct <= flatPct) return 'green';
    if (deltaPct <= -flatPct) return 'green';
    if (deltaPct >= flatPct) return 'red';
    return 'amber';
  },
  bmr(ctx) {
    // Amarillo por defecto; verde si sube junto con músculo; rojo si baja junto con músculo.
    const { deltaPct, flatPct, muscleDeltaPct } = ctx;
    if (Math.abs(deltaPct) < flatPct) return 'amber';
    if (deltaPct > 0 && muscleDeltaPct !== null && muscleDeltaPct >= 0) return 'green';
    if (deltaPct < 0 && muscleDeltaPct !== null && muscleDeltaPct < 0) return 'red';
    return 'amber';
  },
  targetMagnitude(ctx) {
    // Para Weight/Fat/Muscle control: valores tipo "-7.5kg" = kg pendientes para meta.
    // Mejora = la magnitud pendiente se reduce (se acerca a 0).
    const { firstValue, lastValue } = ctx;
    const magFirst = Math.abs(firstValue);
    const magLast = Math.abs(lastValue);
    const diff = magLast - magFirst;
    if (Math.abs(diff) < 0.15) return 'amber';
    return diff < 0 ? 'green' : 'red';
  },
  neutral() {
    return 'neutral';
  }
};

function classifyMetric(metricConfig, firstValue, lastValue, extra) {
  const flatPct = metricConfig.flatPct !== undefined ? metricConfig.flatPct : CONFIG.defaultFlatPct;
  const deltaPct = pctChange(firstValue, lastValue);
  const ctx = {
    deltaPct,
    flatPct,
    firstValue,
    lastValue,
    amberFloorPct: metricConfig.amberFloorPct,
    healthyMax: metricConfig.healthyMax,
    muscleDeltaPct: extra && extra.muscleDeltaPct !== undefined ? extra.muscleDeltaPct : null,
  };
  const fn = METRIC_RULES[metricConfig.ruleType] || METRIC_RULES.higherBetter;
  return { flag: fn(ctx), deltaPct };
}

/* ============================================================
   5. CÁLCULO DE OVERVIEW (primer vs último registro)
   ============================================================ */

function firstDefined(records, key) {
  for (const r of records) {
    if (r[key] && typeof r[key].value === 'number') return r[key].value;
  }
  return null;
}
function lastDefined(records, key) {
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i][key] && typeof records[i][key].value === 'number') return records[i][key].value;
  }
  return null;
}
function unitFor(records, key) {
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i][key] && records[i][key].unit) return records[i][key].unit;
  }
  return '';
}

function buildOverview(records) {
  // Necesitamos el delta de músculo primero, porque BMR depende de él.
  const muscleFirst = firstDefined(records, 'Muscle mass');
  const muscleLast = lastDefined(records, 'Muscle mass');
  const muscleDeltaPct = (muscleFirst !== null && muscleLast !== null) ? pctChange(muscleFirst, muscleLast) : null;

  const overview = [];
  CONFIG.metrics.forEach((m) => {
    const first = firstDefined(records, m.key);
    const last = lastDefined(records, m.key);
    if (first === null || last === null) return; // columna ausente o vacía: se omite sin romper la app

    const { flag, deltaPct } = classifyMetric(m, first, last, { muscleDeltaPct });
    const unit = unitFor(records, m.key);
    const deltaAbs = last - first;
    const trend = Math.abs(deltaAbs) < 1e-9 ? 'flat' : (deltaAbs > 0 ? 'up' : 'down');

    overview.push({
      key: m.key,
      label: m.label,
      unit,
      decimals: m.decimals,
      group: m.group,
      first, last, deltaAbs, deltaPct, trend, flag,
      note: interpretMetric(m, first, last, deltaAbs, deltaPct, unit, trend)
    });
  });

  // Ordena: prioritarias primero, en el orden declarado.
  overview.sort((a, b) => {
    const ia = PRIORITY_ORDER.indexOf(a.key);
    const ib = PRIORITY_ORDER.indexOf(b.key);
    const ra = ia === -1 ? 999 : ia;
    const rb = ib === -1 ? 999 : ib;
    return ra - rb;
  });

  return overview;
}

function fmtNum(n, decimals) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(decimals !== undefined ? decimals : 1);
}

function interpretMetric(m, first, last, deltaAbs, deltaPct, unit, trend) {
  const dirWord = trend === 'up' ? 'subió' : trend === 'down' ? 'bajó' : 'se mantuvo';
  const magnitude = Math.abs(deltaAbs).toFixed(m.decimals !== undefined ? m.decimals : 1);

  switch (m.ruleType) {
    case 'lowerBetter':
      return trend === 'down'
        ? `Bajó ${magnitude}${unit}, en la dirección deseada para esta métrica.`
        : trend === 'up'
          ? `Subió ${magnitude}${unit}; conviene vigilar esta tendencia.`
          : 'Se mantuvo estable en el periodo.';
    case 'higherBetter':
      return trend === 'up'
        ? `Subió ${magnitude}${unit}, señal favorable.`
        : trend === 'down'
          ? `Bajó ${magnitude}${unit}; revisa qué lo está afectando.`
          : 'Sin cambio relevante en el periodo.';
    case 'higherBetterGraded':
      return trend === 'down'
        ? `Bajó ${magnitude}${unit}. Si coincide con pérdida de grasa puede ser aceptable; si no, vigila entrenamiento de fuerza y proteína.`
        : `Se mantuvo o subió (${trend === 'up' ? '+' : ''}${magnitude}${unit}), lo ideal mientras baja la grasa.`;
    case 'visceralFat':
      return `${dirWord.charAt(0).toUpperCase() + dirWord.slice(1)} ${magnitude}${unit}. Valores bajos (orientativamente ≤ ${m.healthyMax || 9}) suelen asociarse a menor riesgo metabólico.`;
    case 'bmr':
      return `${dirWord.charAt(0).toUpperCase() + dirWord.slice(1)} ${magnitude}${unit}. Su lectura depende de si acompaña una ganancia o pérdida de masa muscular.`;
    case 'targetMagnitude':
      return `El ajuste pendiente pasó de ${first.toFixed(1)}${unit} a ${last.toFixed(1)}${unit}.`;
    case 'neutral':
      return `Valor de referencia informativo: ${last.toFixed(1)}${unit}.`;
    default:
      return `${dirWord.charAt(0).toUpperCase() + dirWord.slice(1)} ${magnitude}${unit}.`;
  }
}

/* ============================================================
   6. RENDER — Overview cards
   ============================================================ */

function renderOverview(overview) {
  const grid = document.getElementById('overviewGrid');
  grid.innerHTML = '';

  overview.forEach((m) => {
    const card = document.createElement('div');
    card.className = `metric-card flag-${m.flag === 'neutral' ? '' : m.flag}`.trim();

    const deltaSign = m.deltaAbs > 0 ? '+' : '';
    const deltaClass = m.trend === 'up' ? 'up' : m.trend === 'down' ? 'down' : 'flat';

    card.innerHTML = `
      <div class="metric-name">${m.label}</div>
      <div class="metric-values">
        <span class="metric-final">${fmtNum(m.last, m.decimals)}${m.unit}</span>
        <span class="metric-initial">${fmtNum(m.first, m.decimals)}${m.unit}</span>
      </div>
      <div class="metric-delta ${deltaClass}">
        ${deltaSign}${fmtNum(m.deltaAbs, m.decimals)}${m.unit} (${deltaSign}${fmtNum(m.deltaPct, 1)}%)
      </div>
      <div class="metric-note">${m.note}</div>
    `;
    grid.appendChild(card);
  });
}

/* ============================================================
   7. RENDER — Semáforo de hallazgos (verde/amarillo/rojo)
   ============================================================ */

let currentFindingsFilter = 'all';

function renderFindings(overview) {
  const list = document.getElementById('findingsList');
  const filtered = currentFindingsFilter === 'all'
    ? overview.filter((m) => m.flag !== 'neutral')
    : overview.filter((m) => m.flag === currentFindingsFilter);

  list.innerHTML = '';

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">No hay hallazgos en esta categoría.</div>';
    return;
  }

  filtered.forEach((m) => {
    const item = document.createElement('div');
    item.className = 'finding-item';
    const deltaSign = m.deltaAbs > 0 ? '+' : '';
    item.innerHTML = `
      <div class="finding-dot ${m.flag}"></div>
      <div class="finding-body">
        <div class="finding-title">${m.label}</div>
        <div class="finding-change">${fmtNum(m.first, m.decimals)}${m.unit} → ${fmtNum(m.last, m.decimals)}${m.unit}
          (${deltaSign}${fmtNum(m.deltaAbs, m.decimals)}${m.unit} / ${deltaSign}${fmtNum(m.deltaPct, 1)}%)</div>
        <div class="finding-interp">${m.note}</div>
      </div>
    `;
    list.appendChild(item);
  });
}

function setupFindingsTabs(overview) {
  const tabs = document.querySelectorAll('.findings-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentFindingsFilter = tab.dataset.flag;
      renderFindings(overview);
    });
  });
}

/* ============================================================
   8. RENDER — Gráficas (Chart.js)
   ============================================================ */

let chartInstances = [];

function destroyCharts() {
  chartInstances.forEach((c) => c.destroy());
  chartInstances = [];
}

function seriesFor(records, key) {
  return records.map((r) => (r[key] ? r[key].value : null));
}

function chartLabels(records) {
  return records.map((r) => r.__date.toISOString().slice(0, 10));
}

const CHART_COLORS = {
  teal: '#2BB5A0',
  amber: '#F2B441',
  red: '#E5675F',
  green: '#3FCB7C',
  blue: '#5B9BD5',
  gray: '#8AA6A2'
};

function baseChartOptions(yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#8AA6A2', font: { family: 'IBM Plex Mono', size: 11 } } },
      tooltip: { backgroundColor: '#17201F', borderColor: '#2A3835', borderWidth: 1 }
    },
    scales: {
      x: {
        ticks: { color: '#5D726F', font: { family: 'IBM Plex Mono', size: 10 }, maxRotation: 45, minRotation: 0 },
        grid: { color: '#1E2A28' }
      },
      y: {
        ticks: { color: '#5D726F', font: { family: 'IBM Plex Mono', size: 10 } },
        grid: { color: '#1E2A28' },
        title: yLabel ? { display: true, text: yLabel, color: '#8AA6A2' } : undefined
      }
    }
  };
}

function makeLineDataset(label, data, color, yAxisID) {
  return {
    label, data,
    borderColor: color,
    backgroundColor: color + '22',
    borderWidth: 2,
    pointRadius: data.length > 40 ? 0 : 3,
    pointBackgroundColor: color,
    tension: 0.25,
    spanGaps: true,
    yAxisID: yAxisID || 'y'
  };
}

function renderCharts(records) {
  destroyCharts();
  if (typeof Chart === 'undefined') {
    document.getElementById('chartsGrid').innerHTML =
      '<div class="empty-state">Chart.js no se pudo cargar (sin conexión y sin copia local). Descárgalo para uso 100% offline — ver README.</div>';
    return;
  }

  const labels = chartLabels(records);

  const specs = [
    {
      canvas: 'chartWeightBmiFat',
      title: 'Peso, IMC y grasa corporal',
      build: () => ({
        datasets: [
          makeLineDataset('Peso (kg)', seriesFor(records, 'Weight'), CHART_COLORS.teal, 'y'),
          makeLineDataset('IMC', seriesFor(records, 'BMI'), CHART_COLORS.amber, 'y1'),
          makeLineDataset('Grasa corporal (%)', seriesFor(records, 'Body Fat'), CHART_COLORS.red, 'y1'),
        ]
      }),
      extraScales: { y1: { position: 'right', ticks: { color: '#5D726F' }, grid: { drawOnChartArea: false } } }
    },
    {
      canvas: 'chartFatVsMuscle',
      title: 'Masa grasa vs masa muscular',
      build: () => ({
        datasets: [
          makeLineDataset('Masa grasa (kg)', seriesFor(records, 'Fat mass'), CHART_COLORS.red),
          makeLineDataset('Masa muscular (kg)', seriesFor(records, 'Muscle mass'), CHART_COLORS.teal),
        ]
      })
    },
    {
      canvas: 'chartWaterProtein',
      title: 'Agua corporal y proteína',
      build: () => ({
        datasets: [
          makeLineDataset('Agua corporal (%)', seriesFor(records, 'Body Water'), CHART_COLORS.blue),
          makeLineDataset('Proteína (%)', seriesFor(records, 'Protein'), CHART_COLORS.green),
        ]
      })
    },
    {
      canvas: 'chartVisceral',
      title: 'Grasa visceral',
      build: () => ({ datasets: [makeLineDataset('Grasa visceral', seriesFor(records, 'Visceral Fat'), CHART_COLORS.amber)] })
    },
    {
      canvas: 'chartBodyScore',
      title: 'Body score',
      build: () => ({ datasets: [makeLineDataset('Body score', seriesFor(records, 'Body score'), CHART_COLORS.green)] })
    },
    {
      canvas: 'chartBmr',
      title: 'Metabolismo basal (BMR)',
      build: () => ({ datasets: [makeLineDataset('BMR (kcal)', seriesFor(records, 'BMR'), CHART_COLORS.teal)] })
    },
    {
      canvas: 'chartBodyAge',
      title: 'Edad corporal',
      build: () => ({ datasets: [makeLineDataset('Edad corporal', seriesFor(records, 'Body age'), CHART_COLORS.red)] })
    },
  ];

  specs.forEach((spec) => {
    const ctx = document.getElementById(spec.canvas);
    if (!ctx) return;
    const options = baseChartOptions();
    if (spec.extraScales) Object.assign(options.scales, spec.extraScales);
    const chart = new Chart(ctx, {
      type: 'line',
      data: { labels, ...spec.build() },
      options
    });
    chartInstances.push(chart);
  });
}

/* ============================================================
   9. RENDER — Tabla final
   ============================================================ */

function renderTable(records) {
  const wrap = document.getElementById('tableWrap');
  const cols = ['Date', ...PRIORITY_ORDER, 'Subcutaneous fat', 'Bone Mass', 'Obesity', 'SMI', 'Muscle rate'];

  // Solo columnas que existen en al menos un registro.
  const presentCols = cols.filter((c) => c === 'Date' || records.some((r) => r[c] !== undefined));

  let html = '<table><thead><tr>';
  presentCols.forEach((c) => {
    html += `<th>${c === 'Date' ? 'Fecha' : (CONFIG.metrics.find((m) => m.key === c)?.label || c)}</th>`;
  });
  html += '</tr></thead><tbody>';

  records.forEach((r) => {
    html += '<tr>';
    presentCols.forEach((c) => {
      if (c === 'Date') {
        html += `<td>${r.__date.toISOString().slice(0, 10)} ${String(r.__date.getHours()).padStart(2, '0')}:${String(r.__date.getMinutes()).padStart(2, '0')}</td>`;
      } else {
        const cell = r[c];
        html += `<td>${cell ? fmtNum(cell.value, 1) + cell.unit : '—'}</td>`;
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  wrap.innerHTML = html;
}

/* ============================================================
   10. ORQUESTACIÓN GENERAL
   ============================================================ */

function renderAll(records) {
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('dashboardContent').classList.remove('hidden');
  document.getElementById('recordCount').textContent = `${records.length} registros · ${records[0].__date.toISOString().slice(0,10)} → ${records[records.length-1].__date.toISOString().slice(0,10)}`;

  const overview = buildOverview(records);
  renderOverview(overview);
  renderFindings(overview);
  setupFindingsTabs(overview);
  renderCharts(records);
  renderTable(records);
}

function showEmptyState() {
  document.getElementById('emptyState').classList.remove('hidden');
  document.getElementById('dashboardContent').classList.add('hidden');
}

function handleFile(file) {
  const status = document.getElementById('uploadStatus');
  status.classList.remove('error');
  status.textContent = 'Procesando…';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const records = parseFitdaysCsv(e.target.result);
      if (records.length === 0) throw new Error('No se encontraron registros con fecha válida.');
      saveRecords(records);
      status.textContent = `Cargado: ${records.length} registros.`;
      renderAll(records);
    } catch (err) {
      console.error(err);
      status.classList.add('error');
      status.textContent = `Error al procesar el CSV: ${err.message}`;
    }
  };
  reader.onerror = () => {
    status.classList.add('error');
    status.textContent = 'No se pudo leer el archivo.';
  };
  reader.readAsText(file, 'utf-8');
}

function init() {
  const fileInput = document.getElementById('csvInput');
  const uploadZone = document.getElementById('uploadZone');
  const clearBtn = document.getElementById('clearDataBtn');

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  ['dragover', 'dragenter'].forEach((evt) => {
    uploadZone.addEventListener(evt, (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    uploadZone.addEventListener(evt, (e) => { e.preventDefault(); uploadZone.classList.remove('dragover'); });
  });
  uploadZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  clearBtn.addEventListener('click', () => {
    if (!confirm('¿Borrar todos los datos cargados de este dashboard? Esta acción no se puede deshacer.')) return;
    clearRecords();
    destroyCharts();
    showEmptyState();
    document.getElementById('uploadStatus').textContent = '';
  });

  const existing = loadRecords();
  if (existing && existing.length > 0) {
    renderAll(existing);
  } else {
    showEmptyState();
  }

  // Registro del service worker para soporte offline (si el navegador lo permite).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('No se pudo registrar el service worker:', err);
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
