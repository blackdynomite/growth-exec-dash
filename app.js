const PURPLE = '#7B68EE';
const BLUE = '#49CCF9';
const TEAL = '#79D9B9';
const PINK = '#FD71AF';
const ORANGE = '#FFB08E';
const GREEN = '#2EA043';
const RED = '#F85149';
const GRAY = '#8B949E';

const REPORT_END_DATE = new Date('2026-04-06T00:00:00');
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
const WEEK_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const MONTHS = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(2025, 4 + index, 1);
  return MONTH_LABEL_FORMATTER.format(date);
});
const WEEKS = Array.from({ length: 52 }, (_, index) => {
  const date = new Date(REPORT_END_DATE);
  date.setDate(REPORT_END_DATE.getDate() - (51 - index) * 7);
  return WEEK_LABEL_FORMATTER.format(date);
});
const RANGE_TO_POINTS = {
  monthly: { 3: 3, 6: 6, 12: 12 },
  weekly: { 3: 13, 6: 26, 12: 52 }
};

const SKU_ORDER = ['Free', 'Edu', 'Pro', 'Pro+', 'Business', 'Enterprise'];
const SKU_META = {
  Free: { color: GRAY },
  Edu: { color: PINK },
  Pro: { color: BLUE },
  'Pro+': { color: PURPLE },
  Business: { color: TEAL },
  Enterprise: { color: ORANGE }
};

const charts = {};
const state = {
  granularity: 'monthly',
  range: 12,
  selectedSkus: new Set(SKU_ORDER)
};

const experiments = [
  ['GPT-4.1 Turbo Rollout', 'running', 'Acceptance Rate', '+3.2%', '$18.4M'],
  ['Streaming Completions v2', 'complete', 'Latency P50', '-120ms', '$6.1M'],
  ['Workspace Context Window', 'running', 'Chat Satisfaction', '+8.5%', '$12.7M'],
  ['Agent Auto-Fix', 'running', 'Fix Adoption Rate', '+14.1%', '$9.3M'],
  ['Seat Upsell Nudge', 'paused', 'Expansion Revenue', '-1.2%', '-$0.4M'],
  ['CLI Inline Suggestions', 'complete', 'CLI DAU', '+22.3%', '$3.8M']
];

function fullPointCount() {
  return state.granularity === 'monthly' ? MONTHS.length : WEEKS.length;
}

function visiblePointCount() {
  return RANGE_TO_POINTS[state.granularity][state.range];
}

function labels() {
  const source = state.granularity === 'monthly' ? MONTHS : WEEKS;
  return source.slice(-visiblePointCount());
}

function sparseDateTick(value, index, ticks) {
  const label = this.getLabelForValue(value);
  if (ticks.length <= 4) return label;
  if (index === 0 || index === ticks.length - 1) return label;
  if (ticks.length <= 8 && index === Math.floor((ticks.length - 1) / 2)) return label;
  if (ticks.length <= 16 && index % 3 === 0) return label;
  if (ticks.length > 16 && index % Math.ceil(ticks.length / 4) === 0) return label;
  return '';
}

function tooltipConfig() {
  return {
    enabled: true,
    mode: 'index',
    intersect: false,
    backgroundColor: '#1c2128',
    borderColor: '#21262d',
    borderWidth: 1,
    titleColor: '#E6EDF3',
    bodyColor: '#E6EDF3',
    padding: 10,
    displayColors: true
  };
}

function noisySeries({ start, end, wave = 0, jitter = 0, cycles = 1.5, phase = 0, decimals = 2, floor = null, ceil = null }) {
  const count = fullPointCount();
  const pattern = [0.0, 0.85, -0.5, 1.2, -1.0, 0.45, -0.25, 0.7, -1.35, 0.55, -0.4, 1.0, -0.8];
  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 1 : index / (count - 1);
    const trend = start + (end - start) * progress;
    const sine = wave * Math.sin(progress * Math.PI * 2 * cycles + phase);
    const cosine = wave * 0.45 * Math.cos(progress * Math.PI * 2 * (cycles + 0.37) + phase * 0.5);
    const jagged = jitter * pattern[index % pattern.length];
    let value = trend + sine + cosine + jagged;
    if (floor !== null) value = Math.max(floor, value);
    if (ceil !== null) value = Math.min(ceil, value);
    return Number(value.toFixed(decimals));
  });
}

function visible(series) {
  return series.slice(-visiblePointCount());
}

function sumSeries(seriesList) {
  if (!seriesList.length) return [];
  return seriesList[0].map((_, index) => Number(seriesList.reduce((sum, series) => sum + series[index], 0).toFixed(2)));
}

function ratioSeries(numerator, denominator, decimals = 3) {
  return numerator.map((value, index) => Number((value / denominator[index]).toFixed(decimals)));
}

function latest(series) {
  return series[series.length - 1];
}

function previous(series) {
  return series[series.length - 2] ?? series[0];
}

function pctChange(prev, curr) {
  if (!prev) return '0.0%';
  return `${(((curr - prev) / prev) * 100).toFixed(1)}%`;
}

function selectedSkus() {
  return SKU_ORDER.filter((sku) => state.selectedSkus.has(sku));
}

function hasAllSelected() {
  return state.selectedSkus.size === SKU_ORDER.length;
}

function skuSeries(sku) {
  const definitions = {
    Free: {
      mau: { start: 0.52, end: 0.94, wave: 0.028, jitter: 0.012, cycles: 1.5, phase: 0.2, floor: 0.4 },
      arpu: { start: 0.72, end: 0.9, wave: 0.04, jitter: 0.012, cycles: 1.3, phase: 0.5, floor: 0.55 },
      cogsPerUser: { start: 0.42, end: 0.97, wave: 0.08, jitter: 0.026, cycles: 1.8, phase: 1.1, floor: 0.18 },
      activations: { start: 145, end: 210, wave: 15, jitter: 4.2, cycles: 1.25, phase: 0.3, floor: 80, decimals: 1 }
    },
    Edu: {
      mau: { start: 0.09, end: 0.19, wave: 0.014, jitter: 0.006, cycles: 1.3, phase: 0.7, floor: 0.05 },
      arpu: { start: 1.7, end: 2.4, wave: 0.08, jitter: 0.03, cycles: 1.2, phase: 0.9, floor: 1.2 },
      cogsPerUser: { start: 1.3, end: 2.8, wave: 0.22, jitter: 0.08, cycles: 1.7, phase: 0.2, floor: 0.7 },
      activations: { start: 22, end: 38, wave: 4.0, jitter: 1.2, cycles: 1.2, phase: 0.6, floor: 10, decimals: 1 }
    },
    Pro: {
      mau: { start: 0.28, end: 0.58, wave: 0.022, jitter: 0.011, cycles: 1.25, phase: 0.8, floor: 0.2 },
      arpu: { start: 8.4, end: 10.5, wave: 0.32, jitter: 0.11, cycles: 1.25, phase: 0.5, floor: 6.2 },
      cogsPerUser: { start: 8.0, end: 16.2, wave: 0.95, jitter: 0.34, cycles: 1.55, phase: 0.9, floor: 4.1 },
      activations: { start: 52, end: 91, wave: 7.2, jitter: 2.0, cycles: 1.35, phase: 0.1, floor: 24, decimals: 1 }
    },
    'Pro+': {
      mau: { start: 0.12, end: 0.31, wave: 0.018, jitter: 0.008, cycles: 1.2, phase: 1.4, floor: 0.08 },
      arpu: { start: 19.8, end: 23.1, wave: 0.55, jitter: 0.18, cycles: 1.35, phase: 0.2, floor: 14 },
      cogsPerUser: { start: 14.8, end: 33.7, wave: 1.9, jitter: 0.72, cycles: 1.6, phase: 1.3, floor: 9 },
      activations: { start: 17, end: 34, wave: 3.8, jitter: 1.1, cycles: 1.45, phase: 1.1, floor: 8, decimals: 1 }
    },
    Business: {
      mau: { start: 0.62, end: 1.09, wave: 0.035, jitter: 0.015, cycles: 1.22, phase: 0.6, floor: 0.5 },
      arpu: { start: 22.1, end: 28.3, wave: 0.9, jitter: 0.28, cycles: 1.15, phase: 0.9, floor: 17 },
      cogsPerUser: { start: 18.2, end: 36.4, wave: 2.5, jitter: 0.85, cycles: 1.45, phase: 0.4, floor: 12 },
      activations: { start: 26, end: 56, wave: 4.9, jitter: 1.6, cycles: 1.3, phase: 0.2, floor: 15, decimals: 1 }
    },
    Enterprise: {
      mau: { start: 0.08, end: 0.23, wave: 0.011, jitter: 0.005, cycles: 1.16, phase: 0.9, floor: 0.05 },
      arpu: { start: 35.5, end: 47.1, wave: 1.15, jitter: 0.36, cycles: 1.08, phase: 0.7, floor: 24 },
      cogsPerUser: { start: 21.4, end: 41.7, wave: 2.3, jitter: 0.82, cycles: 1.42, phase: 1.0, floor: 14 },
      activations: { start: 9, end: 19, wave: 2.1, jitter: 0.8, cycles: 1.2, phase: 0.8, floor: 4, decimals: 1 }
    }
  }[sku];

  const mau = noisySeries(definitions.mau);
  const arpu = noisySeries(definitions.arpu);
  const cogsPerUser = noisySeries(definitions.cogsPerUser);
  const activations = noisySeries(definitions.activations);
  const wauMau = noisySeries({ start: 0.56, end: 0.74, wave: 0.018, jitter: 0.005, cycles: 1.3, phase: sku.length * 0.3, floor: 0.45, ceil: 0.85, decimals: 3 });
  const dauWau = noisySeries({ start: 0.42, end: 0.63, wave: 0.02, jitter: 0.006, cycles: 1.45, phase: sku.length * 0.24, floor: 0.35, ceil: 0.8, decimals: 3 });
  const wau = mau.map((value, index) => Number((value * wauMau[index]).toFixed(3)));
  const dau = wau.map((value, index) => Number((value * dauWau[index]).toFixed(3)));
  const revenueMultiplier = state.granularity === 'monthly' ? 1 : 0.24;
  const revenue = mau.map((value, index) => Number((value * arpu[index] * revenueMultiplier).toFixed(2)));
  const cogs = mau.map((value, index) => Number((value * cogsPerUser[index] * revenueMultiplier).toFixed(2)));
  const gp = revenue.map((value, index) => Number((value - cogs[index]).toFixed(2)));

  return { mau, arpu, cogsPerUser, activations, wau, dau, revenue, cogs, gp };
}

function selectedSkuSeries() {
  return selectedSkus().map((sku) => ({ sku, meta: SKU_META[sku], data: skuSeries(sku) }));
}

function aggregateMetric(metric) {
  return sumSeries(selectedSkuSeries().map((entry) => entry.data[metric]));
}

function chartDefaults() {
  Chart.defaults.color = '#8B949E';
  Chart.defaults.borderColor = 'rgba(33,38,45,.6)';
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.padding = 14;
  Chart.defaults.elements.point.radius = 2;
  Chart.defaults.elements.point.hoverRadius = 5;
  Chart.defaults.animation.duration = 500;
}

function baseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#8B949E' } },
      tooltip: tooltipConfig()
    },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { color: '#8B949E', autoSkip: false, maxRotation: 0, minRotation: 0, callback: sparseDateTick },
        grid: { display: false }
      },
      y: { ticks: { color: '#8B949E' }, grid: { color: 'rgba(33,38,45,.6)' } }
    }
  };
}

function destroyAll() {
  Object.values(charts).forEach((chart) => chart.destroy());
  Object.keys(charts).forEach((key) => delete charts[key]);
}

function lineChart(id, datasets, opts = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, {
    type: 'line',
    data: { labels: labels(), datasets },
    options: { ...baseOptions(), ...opts }
  });
}

function barChart(id, chartLabels, datasets, opts = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, {
    type: 'bar',
    data: { labels: chartLabels, datasets },
    options: { ...baseOptions(), ...opts }
  });
}

function donutChart(id, chartLabels, values, colors) {
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, {
    type: 'doughnut',
    data: { labels: chartLabels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8B949E' } }, tooltip: tooltipConfig() },
      cutout: '68%'
    }
  });
}

function tinySpark(id, color, data) {
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, {
    type: 'line',
    data: { labels: labels(), datasets: [{ data: visible(data), borderColor: color, tension: 0.12, fill: false }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: tooltipConfig()
      },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          display: true,
          ticks: { color: '#8B949E', autoSkip: false, maxRotation: 0, minRotation: 0, font: { size: 9 }, callback: sparseDateTick },
          grid: { display: false }
        },
        y: { display: false }
      },
      elements: { point: { radius: 0 } }
    }
  });
}

function regressionTargetSeries(data, upliftRatio = 0.035) {
  if (!data.length) return [];
  const count = data.length;
  const sumX = data.reduce((sum, _, index) => sum + index, 0);
  const sumY = data.reduce((sum, value) => sum + value, 0);
  const sumXY = data.reduce((sum, value, index) => sum + index * value, 0);
  const sumXX = data.reduce((sum, _, index) => sum + index * index, 0);
  const denominator = count * sumXX - sumX * sumX || 1;
  const slope = (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / count;
  const uplift = Math.max(...data) * upliftRatio;
  return data.map((_, index) => Number((intercept + slope * index + uplift).toFixed(1)));
}

function goalSpark(id, color, data) {
  const el = document.getElementById(id);
  if (!el) return;
  const actual = visible(data);
  const target = regressionTargetSeries(actual);
  charts[id] = new Chart(el, {
    type: 'line',
    data: {
      labels: labels(),
      datasets: [
        {
          label: 'Actual',
          data: actual,
          borderColor: color,
          backgroundColor: `${color}18`,
          borderWidth: 2,
          tension: 0.12,
          fill: false,
          pointRadius: 0
        },
        {
          label: 'Target',
          data: target,
          borderColor: 'rgba(230,237,243,0.8)',
          borderDash: [4, 4],
          borderWidth: 1.5,
          tension: 0,
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#8B949E',
            boxWidth: 10,
            padding: 8,
            font: { size: 9 }
          }
        },
        tooltip: tooltipConfig()
      },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          display: true,
          ticks: { color: '#8B949E', autoSkip: false, maxRotation: 0, minRotation: 0, font: { size: 9 }, callback: sparseDateTick },
          grid: { display: false }
        },
        y: { display: false }
      },
      elements: { point: { radius: 0 } }
    }
  });
}

function syncSkuButtons() {
  document.querySelectorAll('#sku-filters .toggle-btn').forEach((button) => {
    if (button.dataset.sku === 'all') {
      button.classList.toggle('active', hasAllSelected());
    } else {
      button.classList.toggle('active', state.selectedSkus.has(button.dataset.sku));
    }
  });
}

function renderKpis() {
  const mau = aggregateMetric('mau');
  const dau = aggregateMetric('dau');
  const revenue = aggregateMetric('revenue');
  const cogs = aggregateMetric('cogs');
  const marginCurrent = ((latest(revenue) - latest(cogs)) / latest(revenue)) * 100;
  const marginPrev = ((previous(revenue) - previous(cogs)) / previous(revenue)) * 100;
  const arr = latest(revenue) * (state.granularity === 'monthly' ? 12 : 52);

  const kpis = [
    ['MAU', `${latest(mau).toFixed(2)}M`, `${pctChange(previous(mau), latest(mau))} vs prior`, 'Selected SKUs only'],
    ['DAU', `${latest(dau).toFixed(2)}M`, `${pctChange(previous(dau), latest(dau))} vs prior`, 'Selected SKUs only'],
    ['ARR', `$${Math.round(arr)}M`, `${pctChange(previous(revenue), latest(revenue))} vs prior`, 'Annualized selected revenue'],
    ['Gross Margin', `${marginCurrent.toFixed(1)}%`, `${(marginCurrent - marginPrev).toFixed(1)}pp vs prior`, 'Selected revenue minus COGS']
  ];

  document.getElementById('kpi-tiles').innerHTML = kpis.map(([label, value, change, frame], index) => `
    <div class="card">
      <div class="card-title">${label}</div>
      <div style="font-size:32px;font-weight:700;color:#E6EDF3;margin-top:6px">${value}</div>
      <div style="font-size:12px;font-weight:600;color:${change.startsWith('-') ? '#F85149' : '#79D9B9'};margin-top:6px">${change}</div>
      <div style="font-size:10px;color:#8B949E;opacity:.8;margin-top:2px">${frame}</div>
      <div class="chart-wrap chart-small" style="margin-top:10px"><canvas id="spark-${index}"></canvas></div>
    </div>
  `).join('');

  tinySpark('spark-0', BLUE, mau);
  tinySpark('spark-1', TEAL, dau);
  tinySpark('spark-2', PURPLE, revenue);
  tinySpark('spark-3', ORANGE, revenue.map((value, index) => Number((((value - cogs[index]) / value) * 100).toFixed(2))));
}

function renderFunnelBars() {
  const currentMau = latest(aggregateMetric('mau'));
  const steps = [
    ['Page Visits', currentMau * 4.5, BLUE],
    ['Signup', currentMau * 1.34, PURPLE],
    ['Account Created', currentMau * 0.82, TEAL],
    ['Activated', currentMau * 0.45, ORANGE],
    ['D30 Retained', currentMau * 0.29, PINK],
    ['Paid', currentMau * 0.22, GREEN]
  ];
  const max = steps[0][1];
  document.getElementById('funnel-bars-wrap').innerHTML = steps.map(([label, value, color]) => `
    <div class="funnel-row">
      <div class="funnel-label">${label}</div>
      <div class="funnel-bar-track"><div class="funnel-bar" style="width:${(value / max) * 100}%;background:${color}">${value.toFixed(2)}M</div></div>
    </div>
  `).join('');
}

function renderExperiments() {
  document.getElementById('experiment-rows').innerHTML = experiments.map(([name, status, metric, lift, npv]) => `
    <tr>
      <td>${name}</td>
      <td><span class="badge badge-${status}">${status[0].toUpperCase() + status.slice(1)}</span></td>
      <td>${metric}</td>
      <td class="${lift.startsWith('-') ? 'lift-neg' : 'lift-pos'}">${lift}</td>
      <td>${npv}</td>
    </tr>
  `).join('');
}

function renderGoalCharts() {
  const goalSpecs = [
    ['goal-ghcp-dau', PURPLE, { start: 46, end: 63, wave: 1.3, jitter: 0.38, cycles: 1.25, phase: 0.0, decimals: 1 }],
    ['goal-ghcp-newusers', GREEN, { start: 40, end: 57, wave: 1.6, jitter: 0.42, cycles: 1.35, phase: 0.4, decimals: 1 }],
    ['goal-ghcp-retention', TEAL, { start: 51, end: 61, wave: 1.0, jitter: 0.24, cycles: 1.15, phase: 0.6, decimals: 1 }],
    ['goal-ghcp-margin', BLUE, { start: 55, end: 67, wave: 0.9, jitter: 0.2, cycles: 1.1, phase: 0.8, decimals: 1 }],
    ['goal-vsc-dau', PINK, { start: 43, end: 59, wave: 1.1, jitter: 0.34, cycles: 1.2, phase: 0.3, decimals: 1 }],
    ['goal-vsc-newusers', PURPLE, { start: 39, end: 52, wave: 1.4, jitter: 0.36, cycles: 1.26, phase: 0.9, decimals: 1 }],
    ['goal-vsc-retention', GREEN, { start: 49, end: 58, wave: 0.8, jitter: 0.22, cycles: 1.18, phase: 0.5, decimals: 1 }],
    ['goal-vsc-cost', TEAL, { start: 58, end: 51, wave: 0.7, jitter: 0.18, cycles: 1.15, phase: 1.0, decimals: 1 }],
    ['goal-cli-dau', BLUE, { start: 41, end: 60, wave: 1.3, jitter: 0.35, cycles: 1.3, phase: 0.2, decimals: 1 }],
    ['goal-cli-newusers', PINK, { start: 38, end: 53, wave: 1.2, jitter: 0.33, cycles: 1.28, phase: 0.7, decimals: 1 }],
    ['goal-cli-retention', PURPLE, { start: 47, end: 57, wave: 0.75, jitter: 0.21, cycles: 1.16, phase: 1.1, decimals: 1 }],
    ['goal-cli-cost', GREEN, { start: 54, end: 47, wave: 0.6, jitter: 0.15, cycles: 1.12, phase: 0.4, decimals: 1 }],
    ['goal-cca-dau', TEAL, { start: 42, end: 61, wave: 1.45, jitter: 0.4, cycles: 1.34, phase: 0.1, decimals: 1 }],
    ['goal-cca-merging', BLUE, { start: 44, end: 56, wave: 1.0, jitter: 0.24, cycles: 1.2, phase: 0.9, decimals: 1 }],
    ['goal-cca-retention', PINK, { start: 46, end: 55, wave: 0.8, jitter: 0.2, cycles: 1.18, phase: 0.6, decimals: 1 }],
    ['goal-cca-cost', PURPLE, { start: 57, end: 50, wave: 0.65, jitter: 0.16, cycles: 1.13, phase: 0.5, decimals: 1 }],
    ['goal-ccr-wau', GREEN, { start: 37, end: 54, wave: 1.1, jitter: 0.31, cycles: 1.23, phase: 0.2, decimals: 1 }],
    ['goal-ccr-prs', TEAL, { start: 34, end: 51, wave: 1.25, jitter: 0.34, cycles: 1.27, phase: 0.8, decimals: 1 }],
    ['goal-ccr-feedback', BLUE, { start: 48, end: 59, wave: 0.85, jitter: 0.22, cycles: 1.19, phase: 0.7, decimals: 1 }],
    ['goal-ccr-cost', PINK, { start: 56, end: 49, wave: 0.6, jitter: 0.15, cycles: 1.1, phase: 1.0, decimals: 1 }]
  ];
  goalSpecs.forEach(([id, color, spec]) => {
    goalSpark(id, color, noisySeries(spec));
  });
}

function renderMainCharts() {
  const skuData = selectedSkuSeries();
  const currentLabels = labels();
  const revenue = aggregateMetric('revenue');
  const cogs = aggregateMetric('cogs');
  const mau = aggregateMetric('mau');
  const wau = aggregateMetric('wau');
  const dau = aggregateMetric('dau');

  barChart('ch-mau-sku', currentLabels, skuData.map((entry) => ({
    label: entry.sku,
    data: visible(entry.data.mau),
    backgroundColor: entry.meta.color,
    borderColor: entry.meta.color,
    borderWidth: 0,
    stack: 'mau-sku'
  })), {
    scales: {
      x: { stacked: true, ticks: { color: '#8B949E' }, grid: { display: false } },
      y: { stacked: true, ticks: { color: '#8B949E' }, grid: { color: 'rgba(33,38,45,.6)' } }
    }
  });

  barChart('ch-mau-growth', currentLabels, [
    { label: 'Activations', data: visible(sumSeries(skuData.map((entry) => entry.data.activations))), backgroundColor: BLUE },
    { label: 'Resurrections', data: visible(noisySeries({ start: 14, end: 29, wave: 3.2, jitter: 1.0, cycles: 1.5, phase: 0.6, decimals: 1 })), backgroundColor: PURPLE },
    { label: 'Churn', data: visible(noisySeries({ start: -28, end: -19, wave: 3.6, jitter: 1.1, cycles: 1.7, phase: 1.2, decimals: 1 })), backgroundColor: RED }
  ]);

  donutChart('ch-act-channel', ['Organic', 'In-Product', 'Paid', 'Partner', 'Sales'], [31, 34, 12, 8, 15], [BLUE, TEAL, PINK, ORANGE, PURPLE]);
  donutChart('ch-act-sku', selectedSkus(), skuData.map((entry) => latest(entry.data.activations)), skuData.map((entry) => entry.meta.color));

  barChart('ch-plan-migration', currentLabels, [
    { label: 'Upgrades', data: visible(noisySeries({ start: 18, end: 34, wave: 4.0, jitter: 1.2, cycles: 1.35, phase: 0.5, decimals: 1 })), backgroundColor: TEAL },
    { label: 'Downgrades', data: visible(noisySeries({ start: 6, end: 4, wave: 1.2, jitter: 0.4, cycles: 1.3, phase: 1.1, floor: 1.4, decimals: 1 })), backgroundColor: RED }
  ]);

  lineChart('ch-upgrade-rates', [
    { label: 'Upgrade Rate', data: visible(noisySeries({ start: 4.2, end: 7.6, wave: 0.4, jitter: 0.08, cycles: 1.25, phase: 0.2 })), borderColor: TEAL, backgroundColor: `${TEAL}22`, fill: false, tension: 0.08 },
    { label: 'Downgrade Rate', data: visible(noisySeries({ start: 2.4, end: 1.5, wave: 0.18, jitter: 0.05, cycles: 1.18, phase: 1.4, floor: 0.8 })), borderColor: RED, backgroundColor: `${RED}22`, fill: false, tension: 0.08 }
  ]);

  barChart('ch-funnel-rates', ['Visit→Signup', 'Signup→Create', 'Create→Active', 'Active→D30', 'D30→Paid'], [{ label: 'Conversion %', data: [30, 60, 55, 80, 78], backgroundColor: [PURPLE, BLUE, TEAL, ORANGE, PINK] }], { scales: { y: { beginAtZero: true, max: 100, ticks: { color: '#8B949E' }, grid: { color: 'rgba(33,38,45,.6)' } } } });

  donutChart('ch-overage', ['Subscription', 'Overage'], [78, 22], [PURPLE, ORANGE]);

  charts['ch-rev-cogs-gm'] = new Chart(document.getElementById('ch-rev-cogs-gm'), {
    type: 'bar',
    data: {
      labels: currentLabels,
      datasets: [
        { label: 'Revenue', data: visible(revenue), backgroundColor: BLUE },
        { label: 'COGS', data: visible(cogs.map((value) => -value)), backgroundColor: RED },
        {
          label: 'Gross Margin %',
          data: visible(revenue.map((value, index) => Number((((value - cogs[index]) / value) * 100).toFixed(1)))),
          type: 'line',
          borderColor: TEAL,
          tension: 0.08,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      ...baseOptions(),
      scales: {
        x: { ticks: { color: '#8B949E' }, grid: { display: false } },
        y: { ticks: { color: '#8B949E' }, grid: { color: 'rgba(33,38,45,.6)' } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#8B949E' } }
      }
    }
  });

  barChart('ch-gp-sku', selectedSkus(), [{ label: 'Gross Profit', data: skuData.map((entry) => Number(latest(entry.data.gp).toFixed(1))), backgroundColor: skuData.map((entry) => entry.meta.color) }]);

  charts['ch-gp-percentile'] = new Chart(document.getElementById('ch-gp-percentile'), {
    type: 'line',
    data: {
      labels: ['P0-50', 'P50-80', 'P80-95', 'P95-99', 'P99-100'],
      datasets: [{ label: 'GP / User', data: [2, -1, -4, -18, -85], borderColor: PINK, backgroundColor: 'rgba(253,113,175,.15)', fill: true, tension: 0.08 }]
    },
    options: baseOptions()
  });

  barChart('ch-arpu-cost', selectedSkus(), [{ label: 'ARPU', data: skuData.map((entry) => Number(latest(entry.data.arpu).toFixed(1))), backgroundColor: skuData.map((entry) => entry.meta.color) }]);
  barChart('ch-cogspu', selectedSkus(), [{ label: 'COGS / User', data: skuData.map((entry) => Number((-latest(entry.data.cogsPerUser)).toFixed(1))), backgroundColor: skuData.map((entry) => entry.meta.color) }]);
  barChart('ch-gppu', selectedSkus(), [{ label: 'GP / User', data: skuData.map((entry) => Number((latest(entry.data.arpu) - latest(entry.data.cogsPerUser)).toFixed(1))), backgroundColor: skuData.map((entry) => entry.meta.color) }]);

  lineChart('ch-wau-mau', [{ label: 'WAU / MAU', data: visible(ratioSeries(wau, mau)), borderColor: BLUE, backgroundColor: `${BLUE}22`, fill: false, tension: 0.08 }]);
  lineChart('ch-dau-wau', [{ label: 'DAU / WAU', data: visible(ratioSeries(dau, wau)), borderColor: TEAL, backgroundColor: `${TEAL}22`, fill: false, tension: 0.08 }]);
  barChart('ch-freq-dist', ['0-1d', '2d', '3d', '4-6d', '7d'], [{ label: 'User Share %', data: [24, 19, 16, 21, 20], backgroundColor: [GRAY, BLUE, PURPLE, TEAL, ORANGE] }]);

  lineChart('ch-interactions', [{ label: 'Interactions / User / Day', data: visible(noisySeries({ start: 12, end: 22, wave: 1.5, jitter: 0.42, cycles: 1.55, phase: 0.4, decimals: 1 })), borderColor: PURPLE, backgroundColor: `${PURPLE}22`, fill: false, tension: 0.04 }]);

  barChart('ch-mau-surface', currentLabels, [
    { label: 'Completions', data: visible(noisySeries({ start: 1.4, end: 2.1, wave: 0.08, jitter: 0.03, cycles: 1.3, phase: 0.2 })), backgroundColor: BLUE },
    { label: 'Chat', data: visible(noisySeries({ start: 0.8, end: 1.4, wave: 0.09, jitter: 0.03, cycles: 1.35, phase: 0.8 })), backgroundColor: PURPLE },
    { label: 'CLI', data: visible(noisySeries({ start: 0.18, end: 0.46, wave: 0.03, jitter: 0.012, cycles: 1.4, phase: 1.1 })), backgroundColor: TEAL },
    { label: 'PR', data: visible(noisySeries({ start: 0.12, end: 0.35, wave: 0.025, jitter: 0.01, cycles: 1.25, phase: 0.6 })), backgroundColor: ORANGE }
  ]);

  lineChart('ch-multi-surface', [{ label: '3+ Surfaces', data: visible(noisySeries({ start: 8, end: 28, wave: 2.8, jitter: 0.9, cycles: 1.45, phase: 0.3, decimals: 1 })), borderColor: TEAL, backgroundColor: `${TEAL}22`, fill: true, tension: 0.04 }], { fill: true });
  donutChart('ch-chat-comp', ['Completions', 'Chat', 'CLI', 'PR'], [39, 40, 11, 10], [BLUE, PURPLE, TEAL, ORANGE]);
  barChart('ch-ret-surface', ['1 Surface', '2', '3', '4+'], [{ label: 'M12 Retention', data: [47, 58, 69, 79], backgroundColor: [GRAY, BLUE, TEAL, PURPLE] }]);

  charts['ch-return-rate'] = new Chart(document.getElementById('ch-return-rate'), {
    type: 'bar',
    data: {
      labels: currentLabels,
      datasets: [
        { label: 'Ever Activated (M)', data: visible(noisySeries({ start: 2.8, end: 6.2, wave: 0.2, jitter: 0.07, cycles: 1.2, phase: 0.2 })), backgroundColor: BLUE },
        { label: 'Current MAU (M)', data: visible(mau), backgroundColor: TEAL },
        { label: 'Return Rate %', data: visible(noisySeries({ start: 38, end: 42, wave: 0.7, jitter: 0.16, cycles: 1.25, phase: 0.8, decimals: 1 })), type: 'line', borderColor: PURPLE, tension: 0.04, yAxisID: 'y1' }
      ]
    },
    options: {
      ...baseOptions(),
      scales: {
        x: { ticks: { color: '#8B949E' }, grid: { display: false } },
        y: { ticks: { color: '#8B949E' }, grid: { color: 'rgba(33,38,45,.6)' } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#8B949E' } }
      }
    }
  });

  charts['ch-jcurves'] = new Chart(document.getElementById('ch-jcurves'), { type: 'line', data: { labels: ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12'], datasets: [{ label: '2025-08', data: [100, 73, 65, 61, 58, 56, 54, 53, 52, 51, 50, 49], borderColor: GRAY, tension: 0.04 }, { label: '2025-11', data: [100, 76, 69, 65, 63, 61, 60, 59, 58, 57, 56, 55], borderColor: BLUE, tension: 0.04 }, { label: '2026-02', data: [100, 81, 74, 70, 68, 66, 65, 64, 63, 62, 61, 60], borderColor: TEAL, tension: 0.04 }] }, options: baseOptions() });
  charts['ch-rev-jcurves'] = new Chart(document.getElementById('ch-rev-jcurves'), { type: 'line', data: { labels: ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12'], datasets: [{ label: '2025-08', data: [100, 82, 79, 80, 81, 83, 84, 85, 86, 87, 87, 88], borderColor: GRAY, tension: 0.04 }, { label: '2025-11', data: [100, 87, 85, 86, 88, 89, 90, 91, 92, 93, 94, 95], borderColor: BLUE, tension: 0.04 }, { label: '2026-02', data: [100, 91, 90, 92, 94, 96, 97, 98, 99, 101, 102, 103], borderColor: TEAL, tension: 0.04 }] }, options: baseOptions() });

  lineChart('ch-ret-milestones', [
    { label: 'M1', data: visible(noisySeries({ start: 72, end: 81, wave: 0.9, jitter: 0.2, cycles: 1.4, phase: 0.1, decimals: 1 })), borderColor: BLUE, backgroundColor: `${BLUE}22`, fill: false, tension: 0.04 },
    { label: 'M3', data: visible(noisySeries({ start: 61, end: 67, wave: 0.7, jitter: 0.18, cycles: 1.25, phase: 0.6, decimals: 1 })), borderColor: PURPLE, backgroundColor: `${PURPLE}22`, fill: false, tension: 0.04 },
    { label: 'M6', data: visible(noisySeries({ start: 55, end: 58, wave: 0.45, jitter: 0.12, cycles: 1.15, phase: 1.1, decimals: 1 })), borderColor: TEAL, backgroundColor: `${TEAL}22`, fill: false, tension: 0.04 },
    { label: 'M12', data: visible(noisySeries({ start: 58, end: 58, wave: 0.25, jitter: 0.08, cycles: 1.2, phase: 0.3, decimals: 1 })), borderColor: ORANGE, backgroundColor: `${ORANGE}22`, fill: false, tension: 0.04 }
  ]);

  lineChart('ch-cohort-rev', [
    { label: '2025-Q4', data: visible(noisySeries({ start: 22, end: 38, wave: 1.8, jitter: 0.45, cycles: 1.3, phase: 0.4, decimals: 1 })), borderColor: BLUE, backgroundColor: `${BLUE}22`, fill: false, tension: 0.04 },
    { label: '2026-Q1', data: visible(noisySeries({ start: 30, end: 52, wave: 2.2, jitter: 0.55, cycles: 1.25, phase: 1.0, decimals: 1 })), borderColor: TEAL, backgroundColor: `${TEAL}22`, fill: false, tension: 0.04 }
  ]);
  lineChart('ch-cohort-rev-user', [{ label: 'Revenue / User', data: visible(noisySeries({ start: 11, end: 15.6, wave: 0.4, jitter: 0.13, cycles: 1.3, phase: 0.6, decimals: 1 })), borderColor: PURPLE, backgroundColor: `${PURPLE}22`, fill: false, tension: 0.04 }]);
  lineChart('ch-cohort-gp', [{ label: 'Cohort COGS', data: visible(noisySeries({ start: 18, end: 9.8, wave: 1.0, jitter: 0.25, cycles: 1.2, phase: 0.5, decimals: 1 })), borderColor: RED, backgroundColor: `${RED}22`, fill: false, tension: 0.04 }]);
  lineChart('ch-cohort-gp-user', [{ label: 'COGS / User', data: visible(noisySeries({ start: 6.2, end: 9.4, wave: 0.35, jitter: 0.11, cycles: 1.2, phase: 0.7, decimals: 1 })), borderColor: ORANGE, backgroundColor: `${ORANGE}22`, fill: false, tension: 0.04 }]);
  lineChart('ch-seat-util', [
    { label: 'Utilization %', data: visible(noisySeries({ start: 69, end: 79, wave: 1.4, jitter: 0.35, cycles: 1.35, phase: 0.2, decimals: 1 })), borderColor: TEAL, backgroundColor: `${TEAL}22`, fill: false, tension: 0.04 },
    { label: 'Assigned Seats (k)', data: visible(noisySeries({ start: 310, end: 480, wave: 14, jitter: 4, cycles: 1.2, phase: 1.1, decimals: 1 })), borderColor: BLUE, backgroundColor: `${BLUE}22`, fill: false, tension: 0.04 }
  ]);

  barChart('ch-expansion', currentLabels, [
    { label: 'New ARR', data: visible(noisySeries({ start: 12, end: 30, wave: 2.4, jitter: 0.8, cycles: 1.3, phase: 0.2, decimals: 1 })), backgroundColor: BLUE },
    { label: 'Expansion', data: visible(noisySeries({ start: 8, end: 22, wave: 1.7, jitter: 0.6, cycles: 1.35, phase: 1.0, decimals: 1 })), backgroundColor: TEAL },
    { label: 'Contraction', data: visible(noisySeries({ start: -4, end: -8, wave: 0.8, jitter: 0.25, cycles: 1.15, phase: 0.5, decimals: 1 })), backgroundColor: ORANGE },
    { label: 'Churn', data: visible(noisySeries({ start: -6, end: -10, wave: 0.9, jitter: 0.28, cycles: 1.2, phase: 1.2, decimals: 1 })), backgroundColor: RED }
  ]);
}

function wireToggles() {
  document.querySelectorAll('#granularity-toggle .toggle-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#granularity-toggle .toggle-btn').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      state.granularity = button.dataset.gran;
      renderAll();
    });
  });

  document.querySelectorAll('#range-toggle .toggle-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#range-toggle .toggle-btn').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      state.range = Number(button.dataset.range);
      renderAll();
    });
  });

  document.querySelectorAll('#sku-filters .toggle-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const sku = button.dataset.sku;
      if (sku === 'all') {
        state.selectedSkus = hasAllSelected() ? new Set(['Business']) : new Set(SKU_ORDER);
      } else if (state.selectedSkus.has(sku)) {
        if (state.selectedSkus.size > 1) state.selectedSkus.delete(sku);
      } else {
        state.selectedSkus.add(sku);
      }
      syncSkuButtons();
      renderAll();
    });
  });
}

function wireNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navItems.forEach((item) => item.classList.toggle('active', item.dataset.section === entry.target.id));
    });
  }, { threshold: 0.3 });
  sections.forEach((section) => observer.observe(section));
}

function renderAll() {
  destroyAll();
  syncSkuButtons();
  renderKpis();
  renderFunnelBars();
  renderExperiments();
  renderMainCharts();
  renderGoalCharts();
}

chartDefaults();
wireToggles();
wireNav();
renderAll();