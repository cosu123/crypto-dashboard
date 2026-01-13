// Configuración de Google Sheets
const SHEET_ID = '1Bx0NizfyQjrLVkuHRLcWBK1_ZOFSRtF9vOql4IV5Ap4';
const SHEET_NAMES = {
  PORTAFOLIO: 'Portafolio',
  PRECIOS: '_Hist_Precios',
  CHECKLIST: 'Checklist_Semanal'
};

// URLs de la API de Google Sheets (sin autenticación para hojas públicas)
const getSheetURL = (sheetName) => 
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

// Estado global
let appData = {
  portafolio: [],
  precios: [],
  lastUpdate: null,
  isOnline: navigator.onLine,
  charts: {}
};

// Inicializar la aplicación
async function init() {
  console.log('🚀 Inicializando dashboard...');
  
  // Registrar Service Worker para funcionalidad offline
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
      console.log('✓ Service Worker registrado');
    } catch (err) {
      console.warn('Service Worker no disponible:', err);
    }
  }

  // Detectar cambios de conectividad
  window.addEventListener('online', () => {
    appData.isOnline = true;
    updateStatus('online');
    refreshData();
  });
  
  window.addEventListener('offline', () => {
    appData.isOnline = false;
    updateStatus('offline');
  });

  // Cargar tema guardado
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon();

  // Cargar datos
  await refreshData();

  // Auto-actualizar cada 5 minutos
  setInterval(refreshData, 5 * 60 * 1000);
}

// Actualizar estado de conexión
function updateStatus(status) {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  
  if (status === 'online') {
    pill.className = 'pill online';
    text.textContent = 'En línea';
  } else if (status === 'offline') {
    pill.className = 'pill offline';
    text.textContent = 'Sin conexión';
  } else {
    pill.className = 'pill';
    text.textContent = status;
  }
}

// Refrescar datos desde Google Sheets
async function refreshData() {
  try {
    updateStatus('Sincronizando...');
    console.log('🔄 Cargando datos desde Google Sheets...');

    // Cargar datos del portafolio
    const portafolioData = await fetchSheetData(SHEET_NAMES.PORTAFOLIO);
    const preciosData = await fetchSheetData(SHEET_NAMES.PRECIOS);

    if (portafolioData && portafolioData.length > 0) {
      appData.portafolio = portafolioData;
      appData.precios = preciosData || [];
      appData.lastUpdate = new Date();

      // Guardar en localStorage para modo offline
      localStorage.setItem('cachedData', JSON.stringify(appData));

      // Actualizar UI
      updateKPIs();
      updateCharts();
      updateTable();
      updateLastUpdateTime();

      updateStatus('online');
      console.log('✓ Datos cargados:', appData.portafolio.length, 'transacciones');
    } else {
      throw new Error('No se pudieron cargar los datos');
    }
  } catch (error) {
    console.error('Error al cargar datos:', error);
    
    // Intentar cargar desde caché
    const cached = localStorage.getItem('cachedData');
    if (cached) {
      const cachedData = JSON.parse(cached);
      appData = cachedData;
      updateKPIs();
      updateCharts();
      updateTable();
      updateLastUpdateTime();
      updateStatus('offline');
      console.log('✓ Datos cargados desde caché');
    } else {
      updateStatus('Error de conexión');
      alert('No se pudieron cargar los datos. Por favor, verifica tu conexión.');
    }
  }
}

// Obtener datos de una hoja de Google Sheets
async function fetchSheetData(sheetName) {
  try {
    const url = getSheetURL(sheetName);
    const response = await fetch(url);
    const text = await response.text();
    
    // Google Sheets devuelve JSONP, necesitamos extraer el JSON
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
    if (!jsonMatch) throw new Error('Formato de respuesta inválido');
    
    const data = JSON.parse(jsonMatch[1]);
    
    if (!data.table || !data.table.rows) {
      throw new Error('No hay datos en la hoja');
    }

    // Convertir a formato de array de objetos
    const headers = data.table.cols.map(col => col.label || col.id);
    const rows = data.table.rows.map(row => {
      const obj = {};
      row.c.forEach((cell, idx) => {
        obj[headers[idx]] = cell ? (cell.v !== null ? cell.v : cell.f) : null;
      });
      return obj;
    });

    return rows;
  } catch (error) {
    console.error(`Error al cargar ${sheetName}:`, error);
    throw error;
  }
}

// Actualizar KPIs
function updateKPIs() {
  const data = appData.portafolio;
  
  if (!data || data.length === 0) return;

  // Calcular métricas
  let totalInvertido = 0;
  let totalActual = 0;
  const activos = new Set();
  const exchanges = new Set();

  data.forEach(row => {
    const inversion = parseFloat(row['Inversión USDT'] || row['Inversion USDT'] || 0);
    const valorActual = parseFloat(row['Valor Actual'] || row['Valor Actual USDT'] || 0);
    const activo = row['Activo'];
    const exchange = row['Exchange/Plataforma'] || row['Exchange'];

    if (!isNaN(inversion)) totalInvertido += inversion;
    if (!isNaN(valorActual)) totalActual += valorActual;
    if (activo) activos.add(activo);
    if (exchange) exchanges.add(exchange);
  });

  const pl = totalActual - totalInvertido;
  const plPercent = totalInvertido > 0 ? (pl / totalInvertido * 100) : 0;

  // Actualizar UI
  document.getElementById('kpiInvertido').textContent = formatCurrency(totalInvertido);
  document.getElementById('kpiActual').textContent = formatCurrency(totalActual);
  document.getElementById('kpiPL').textContent = formatCurrency(pl);
  document.getElementById('kpiPL').style.color = pl >= 0 ? 'var(--ok)' : 'var(--bad)';
  document.getElementById('kpiPLPercent').textContent = formatPercent(plPercent);
  document.getElementById('kpiPLPercent').style.color = pl >= 0 ? 'var(--ok)' : 'var(--bad)';
  document.getElementById('kpiActivos').textContent = activos.size;
  document.getElementById('kpiTransacciones').textContent = data.length;
  document.getElementById('kpiExchanges').textContent = exchanges.size;
}

// Actualizar gráficos
function updateCharts() {
  updatePriceChart();
  updatePortfolioChart();
}

// Gráfico de evolución de precios
function updatePriceChart() {
  const ctx = document.getElementById('priceChart');
  if (!ctx) return;

  // Destruir gráfico anterior si existe
  if (appData.charts.priceChart) {
    appData.charts.priceChart.destroy();
  }

  const preciosData = appData.precios;
  
  // Agrupar por activo
  const activosMap = {};
  preciosData.forEach(row => {
    const activo = row['Activo'];
    const fecha = row['FechaISO'] || row['Fecha'];
    const precio = parseFloat(row['Precio']);

    if (!activo || !fecha || isNaN(precio)) return;

    if (!activosMap[activo]) {
      activosMap[activo] = { labels: [], data: [] };
    }
    activosMap[activo].labels.push(new Date(fecha));
    activosMap[activo].data.push(precio);
  });

  // Tomar los 5 activos principales
  const topActivos = Object.keys(activosMap).slice(0, 5);
  const colors = {
    'BTC': '#f7931a',
    'ETH': '#627eea',
    'SOL': '#14f195',
    'LINK': '#2a5ada',
    'AVAX': '#e84142'
  };

  const datasets = topActivos.map(activo => ({
    label: activo,
    data: activosMap[activo].data,
    borderColor: colors[activo] || '#4dd6ff',
    backgroundColor: (colors[activo] || '#4dd6ff') + '20',
    borderWidth: 2,
    tension: 0.4,
    fill: false
  }));

  // Usar las fechas del primer activo como labels
  const labels = topActivos.length > 0 
    ? activosMap[topActivos[0]].labels.map(d => d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }))
    : [];

  appData.charts.priceChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: 'var(--text)', font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'var(--tt-bg)',
          titleColor: 'var(--tt-title)',
          bodyColor: 'var(--tt-body)',
          borderColor: 'var(--tt-border)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'var(--grid)' },
          ticks: { color: 'var(--tick)', font: { size: 10 } }
        },
        y: {
          grid: { color: 'var(--grid)' },
          ticks: { 
            color: 'var(--tick)', 
            font: { size: 10 },
            callback: value => '$' + value.toLocaleString()
          }
        }
      }
    }
  });
}

// Gráfico de distribución del portafolio
function updatePortfolioChart() {
  const ctx = document.getElementById('portfolioChart');
  if (!ctx) return;

  // Destruir gráfico anterior si existe
  if (appData.charts.portfolioChart) {
    appData.charts.portfolioChart.destroy();
  }

  const data = appData.portafolio;
  
  // Agrupar por activo
  const activosMap = {};
  data.forEach(row => {
    const activo = row['Activo'];
    const valorActual = parseFloat(row['Valor Actual'] || row['Valor Actual USDT'] || 0);

    if (!activo || isNaN(valorActual)) return;

    if (!activosMap[activo]) {
      activosMap[activo] = 0;
    }
    activosMap[activo] += valorActual;
  });

  const labels = Object.keys(activosMap);
  const valores = Object.values(activosMap);
  const colors = {
    'BTC': '#f7931a',
    'ETH': '#627eea',
    'SOL': '#14f195',
    'LINK': '#2a5ada',
    'AVAX': '#e84142'
  };
  const backgroundColors = labels.map(activo => colors[activo] || '#4dd6ff');

  appData.charts.portfolioChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: backgroundColors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: { color: 'var(--text)', font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'var(--tt-bg)',
          titleColor: 'var(--tt-title)',
          bodyColor: 'var(--tt-body)',
          borderColor: 'var(--tt-border)',
          borderWidth: 1,
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percent = ((value / total) * 100).toFixed(1);
              return `${label}: $${value.toLocaleString()} (${percent}%)`;
            }
          }
        }
      }
    }
  });
}

// Actualizar tabla de transacciones
function updateTable() {
  const tbody = document.getElementById('transactionsBody');
  if (!tbody) return;

  const data = appData.portafolio.slice(0, 20); // Últimas 20 transacciones

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--muted)">No hay datos disponibles</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => {
    const fecha = row['Fecha'] ? new Date(row['Fecha']).toLocaleDateString('es-ES') : '--';
    const activo = row['Activo'] || '--';
    const tipo = row['Tipo'] || '--';
    const inversion = formatCurrency(parseFloat(row['Inversión USDT'] || row['Inversion USDT'] || 0));
    const cantidad = parseFloat(row['Cantidad/Moneda Crypto'] || row['Cantidad'] || 0).toFixed(6);
    const precio = formatCurrency(parseFloat(row['Precio Compra'] || row['Precio'] || 0));

    return `
      <tr>
        <td>${fecha}</td>
        <td><strong>${activo}</strong></td>
        <td>${tipo}</td>
        <td>${inversion}</td>
        <td>${cantidad}</td>
        <td>${precio}</td>
      </tr>
    `;
  }).join('');
}

// Actualizar tiempo de última actualización
function updateLastUpdateTime() {
  const elem = document.getElementById('lastUpdate');
  if (!elem || !appData.lastUpdate) return;

  const now = new Date();
  const diff = Math.floor((now - appData.lastUpdate) / 1000); // segundos

  let timeStr;
  if (diff < 60) {
    timeStr = 'hace unos segundos';
  } else if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    timeStr = `hace ${mins} minuto${mins > 1 ? 's' : ''}`;
  } else {
    timeStr = appData.lastUpdate.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  elem.textContent = timeStr;
}

// Alternar tema
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon();

  // Re-renderizar gráficos para actualizar colores
  if (appData.portafolio.length > 0) {
    updateCharts();
  }
}

// Actualizar ícono del tema
function updateThemeIcon() {
  const icon = document.getElementById('themeIcon');
  const theme = document.documentElement.getAttribute('data-theme');
  icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Formatear moneda
function formatCurrency(value) {
  if (isNaN(value)) return '$0.00';
  return '$' + value.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

// Formatear porcentaje
function formatPercent(value) {
  if (isNaN(value)) return '0%';
  return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Actualizar tiempo cada minuto
setInterval(updateLastUpdateTime, 60000);
