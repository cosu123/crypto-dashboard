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

// Convertir fecha de Google Sheets a Date
function parseGoogleDate(dateValue) {
  if (!dateValue) return null;
  
  // Si es un objeto Date de Google Sheets: Date(2024,9,23,19,7,57)
  if (typeof dateValue === 'string' && dateValue.startsWith('Date(')) {
    const match = dateValue.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]); // Ya está en base 0
      const day = parseInt(match[3]);
      const hour = parseInt(match[4] || 0);
      const minute = parseInt(match[5] || 0);
      const second = parseInt(match[6] || 0);
      return new Date(year, month, day, hour, minute, second);
    }
  }
  
  // Si es un string de fecha normal
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Si es un timestamp
  if (typeof dateValue === 'number') {
    return new Date(dateValue);
  }
  
  return null;
}

// Obtener valor numérico seguro
function getNumericValue(value) {
  if (value === null || value === undefined || value === '' || value === '-' || value === '--') {
    return 0;
  }
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
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

      console.log('✓ Datos cargados:', {
        portafolio: appData.portafolio.length,
        precios: appData.precios.length,
        primeraFila: appData.portafolio[0]
      });

      // Guardar en localStorage para modo offline
      localStorage.setItem('cachedData', JSON.stringify({
        portafolio: appData.portafolio,
        precios: appData.precios,
        lastUpdate: appData.lastUpdate.toISOString()
      }));

      // Actualizar UI
      updateKPIs();
      updateCharts();
      updateTable();
      updateLastUpdateTime();

      updateStatus('online');
    } else {
      throw new Error('No se pudieron cargar los datos');
    }
  } catch (error) {
    console.error('Error al cargar datos:', error);
    
    // Intentar cargar desde caché
    const cached = localStorage.getItem('cachedData');
    if (cached) {
      const cachedData = JSON.parse(cached);
      appData.portafolio = cachedData.portafolio;
      appData.precios = cachedData.precios;
      appData.lastUpdate = new Date(cachedData.lastUpdate);
      
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
        const header = headers[idx];
        if (cell === null) {
          obj[header] = null;
        } else {
          // Usar el valor 'v' (value) en lugar de 'f' (formatted)
          obj[header] = cell.v !== null && cell.v !== undefined ? cell.v : cell.f;
        }
      });
      return obj;
    });

    console.log(`✓ Hoja "${sheetName}" cargada:`, {
      filas: rows.length,
      columnas: headers.length,
      headers: headers.slice(0, 10)
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
  
  if (!data || data.length === 0) {
    console.warn('No hay datos para calcular KPIs');
    return;
  }

  // Calcular métricas
  let totalInvertido = 0;
  let totalActual = 0;
  const activos = new Set();
  const exchanges = new Set();
  let transaccionesValidas = 0;

  data.forEach((row, idx) => {
    // Usar los nombres exactos de las columnas del Google Sheet
    const inversion = getNumericValue(row['Inversión USDT']);
    const valorActual = getNumericValue(row['Valor Actual']);
    const activo = row['Activo'];
    const exchange = row['Exchange/Plataforma'];

    if (inversion > 0) {
      totalInvertido += inversion;
      transaccionesValidas++;
    }
    
    if (valorActual > 0) {
      totalActual += valorActual;
    }
    
    if (activo && activo !== '' && activo !== '-') {
      activos.add(activo);
    }
    
    if (exchange && exchange !== '' && exchange !== '-') {
      exchanges.add(exchange);
    }

    // Log de las primeras 3 filas para debugging
    if (idx < 3) {
      console.log(`Fila ${idx}:`, {
        activo,
        inversion,
        valorActual,
        exchange
      });
    }
  });

  const pl = totalActual - totalInvertido;
  const plPercent = totalInvertido > 0 ? (pl / totalInvertido * 100) : 0;

  console.log('📊 KPIs calculados:', {
    totalInvertido,
    totalActual,
    pl,
    plPercent,
    activos: activos.size,
    transacciones: transaccionesValidas,
    exchanges: exchanges.size
  });

  // Actualizar UI
  document.getElementById('kpiInvertido').textContent = formatCurrency(totalInvertido);
  document.getElementById('kpiActual').textContent = formatCurrency(totalActual);
  document.getElementById('kpiPL').textContent = formatCurrency(pl);
  document.getElementById('kpiPL').style.color = pl >= 0 ? 'var(--ok)' : 'var(--bad)';
  document.getElementById('kpiPLPercent').textContent = formatPercent(plPercent);
  document.getElementById('kpiPLPercent').style.color = pl >= 0 ? 'var(--ok)' : 'var(--bad)';
  document.getElementById('kpiActivos').textContent = activos.size;
  document.getElementById('kpiTransacciones').textContent = transaccionesValidas;
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
  
  if (!preciosData || preciosData.length === 0) {
    console.warn('No hay datos de precios para el gráfico');
    return;
  }

  // Agrupar por activo
  const activosMap = {};
  preciosData.forEach(row => {
    const activo = row['Activo'];
    const fecha = parseGoogleDate(row['FechaISO'] || row['Fecha']);
    const precio = getNumericValue(row['Precio']);

    if (!activo || !fecha || precio === 0) return;

    if (!activosMap[activo]) {
      activosMap[activo] = [];
    }
    activosMap[activo].push({ fecha, precio });
  });

  // Ordenar por fecha y tomar los 5 activos principales
  Object.keys(activosMap).forEach(activo => {
    activosMap[activo].sort((a, b) => a.fecha - b.fecha);
  });

  const topActivos = Object.keys(activosMap).slice(0, 5);
  const colors = {
    'BTC': '#f7931a',
    'ETH': '#627eea',
    'SOL': '#14f195',
    'LINK': '#2a5ada',
    'AVAX': '#e84142'
  };

  // Crear datasets
  const datasets = topActivos.map(activo => {
    const data = activosMap[activo];
    return {
      label: activo,
      data: data.map(d => ({ x: d.fecha, y: d.precio })),
      borderColor: colors[activo] || '#4dd6ff',
      backgroundColor: (colors[activo] || '#4dd6ff') + '20',
      borderWidth: 2,
      tension: 0.4,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 4
    };
  });

  appData.charts.priceChart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
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
          type: 'time',
          time: {
            unit: 'day',
            displayFormats: {
              day: 'MMM d'
            }
          },
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
    const valorActual = getNumericValue(row['Valor Actual']);

    if (!activo || activo === '' || activo === '-' || valorActual === 0) return;

    if (!activosMap[activo]) {
      activosMap[activo] = 0;
    }
    activosMap[activo] += valorActual;
  });

  const labels = Object.keys(activosMap);
  const valores = Object.values(activosMap);
  
  if (labels.length === 0) {
    console.warn('No hay datos para el gráfico de distribución');
    return;
  }

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
          labels: { color: 'var(--text)', font: { size: 11 }, padding: 10 }
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
              const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
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

  const data = appData.portafolio.filter(row => {
    const inversion = getNumericValue(row['Inversión USDT']);
    return inversion > 0; // Solo mostrar transacciones con inversión
  }).slice(0, 20); // Últimas 20 transacciones

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:40px">No hay datos disponibles</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => {
    const fechaRaw = row['Fecha'];
    const fecha = parseGoogleDate(fechaRaw);
    const fechaStr = fecha ? fecha.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }) : '--';
    
    const activo = row['Activo'] || '--';
    const tipo = row['Tipo'] || '--';
    const inversion = getNumericValue(row['Inversión USDT']);
    const cantidad = getNumericValue(row['Cantidad/Moneda Crypto']);
    const precio = getNumericValue(row['Precio Compra']);

    return `
      <tr>
        <td>${fechaStr}</td>
        <td><strong style="color: var(--accent2)">${activo}</strong></td>
        <td>${tipo}</td>
        <td>${formatCurrency(inversion)}</td>
        <td>${cantidad.toFixed(6)}</td>
        <td>${formatCurrency(precio)}</td>
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
  if (isNaN(value) || value === null) return '$0.00';
  return '$' + value.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

// Formatear porcentaje
function formatPercent(value) {
  if (isNaN(value) || value === null) return '0%';
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
