/* ============================================
   HEIDI CRYPTO PORTFOLIO - PREMIUM APP
   Sincronización en tiempo real con Google Sheets
   ============================================ */

// Estado global
const state = {
  data: null,
  activos: [],
  transacciones: [],
  lastUpdate: null,
  charts: {},
  autoRefreshInterval: null
};

// Inicializar app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

console.log('🚀 Script cargado - HEIDI Crypto Portfolio');

async function initApp() {
  // Cargar tema guardado
  loadTheme();
  
  // Cargar datos iniciales
  await loadData();
  
  // Ocultar loading screen
  setTimeout(() => {
    document.getElementById('loadingScreen').classList.add('hidden');
  }, 1500);
  
  // Configurar auto-refresh
  setupAutoRefresh();
  
  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.log('SW registration failed:', err);
    });
  }
}

// ============================================
// CARGA DE DATOS DESDE GOOGLE SHEETS
// ============================================

async function loadData() {
  try {
    console.log('📊 Iniciando carga de datos...');
    updateStatus('Sincronizando...', 'loading');
    
    const sheetId = DASHBOARD_CONFIG.SHEET_ID;
    const sheetName = DASHBOARD_CONFIG.SHEETS.PORTAFOLIO;
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
    
    console.log('🌐 Fetching:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    console.log('✅ Respuesta recibida, parseando...');
    
    // Parsear respuesta de Google Sheets
    const jsonText = text.substring(47).slice(0, -2);
    const json = JSON.parse(jsonText);
    
    console.log('✅ Datos parseados:', json.table.rows.length, 'filas');
    
    // Procesar datos
    processData(json);
    console.log('✅ Datos procesados');
    
    // Actualizar UI
    console.log('📊 Actualizando KPIs...');
    updateKPIs();
    
    console.log('📈 Renderizando gráficos...');
    renderCharts();
    
    console.log('📅 Renderizando watchlist...');
    renderWatchlist();
    
    console.log('📊 Renderizando tabla...');
    renderTable();
    
    // Actualizar estado
    state.lastUpdate = new Date();
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
      lastUpdateEl.textContent = formatTime(state.lastUpdate);
    }
    updateStatus('En línea', 'online');
    
    console.log('✅ Dashboard actualizado correctamente');
    
  } catch (error) {
    console.error('❌ Error cargando datos:', error);
    console.error('Stack:', error.stack);
    updateStatus('Error de conexión', 'offline');
    
    // Mostrar error en la UI
    alert('Error cargando datos: ' + error.message);
  }
}

function processData(json) {
  const rows = json.table.rows;
  const cols = json.table.cols;
  
  state.transacciones = [];
  const activosMap = new Map();
  
  // Procesar cada fila
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].c;
    if (!row) continue;
    
    // Extraer valores
    const activo = getValue(row[1]); // Columna B - Activo
    const activosCol = getValue(row[18]); // Columna S - Activos (indica si es resumen)
    
    // Si es una fila de resumen por activo
    if (activo && activosCol && activosCol.includes('Total')) {
      const activoKey = DASHBOARD_CONFIG.ACTIVOS_MAPPING[activosCol] || activo;
      
      activosMap.set(activoKey, {
        nombre: DASHBOARD_CONFIG.NOMBRES[activoKey] || activoKey,
        simbolo: activoKey,
        inversion: getNumericValue(row[19]), // Columna T - Inversion inicial Usdt
        valorActual: getNumericValue(row[21]), // Columna V - Total Valor actual Usdt
        profitLoss: getNumericValue(row[20]), // Columna U - Total Profit/loss
        porcentajePortafolio: getNumericValue(row[22]) * 100, // Columna W - % Portafolio
        roi: getNumericValue(row[23]) * 100, // Columna X - ROI %
        color: DASHBOARD_CONFIG.COLORS[activoKey] || '#888',
        icon: DASHBOARD_CONFIG.ICONS[activoKey] || '●'
      });
    }
    
    // Si es una transacción individual
    if (activo && !activosCol) {
      state.transacciones.push({
        fecha: parseGoogleDate(getValue(row[0])),
        activo: activo,
        inversion: getNumericValue(row[2]),
        tipo: getValue(row[3]),
        orden: getValue(row[4]),
        exchange: getValue(row[5]),
        cantidad: getNumericValue(row[6]),
        precioCompra: getNumericValue(row[7]),
        precioVenta: getNumericValue(row[8]),
        precioActual: getNumericValue(row[10]),
        valorInicial: getNumericValue(row[11]),
        valorActual: getNumericValue(row[12]),
        profitLoss: getNumericValue(row[13]),
        variacion: getNumericValue(row[14])
      });
    }
  }
  
  state.activos = Array.from(activosMap.values())
    .filter(a => a.inversion > 0)
    .sort((a, b) => b.porcentajePortafolio - a.porcentajePortafolio);
  
  console.log('📈 Activos procesados:', state.activos.length);
  console.log('💼 Transacciones procesadas:', state.transacciones.length);
  console.log('Activos:', state.activos);
}

// Funciones auxiliares
function getValue(cell) {
  if (!cell || cell.v === null || cell.v === undefined) return null;
  return cell.f || cell.v;
}

function getNumericValue(cell) {
  const val = getValue(cell);
  if (val === null || val === '' || val === '-' || val === '--') return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function parseGoogleDate(cell) {
  const val = getValue(cell);
  if (!val) return null;
  
  // Si es formato Date(2024,9,23,19,7,57)
  if (typeof val === 'string' && val.startsWith('Date(')) {
    const match = val.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      const hour = parseInt(match[4] || 0);
      const minute = parseInt(match[5] || 0);
      const second = parseInt(match[6] || 0);
      return new Date(year, month, day, hour, minute, second);
    }
  }
  
  // Intentar parsear como fecha normal
  if (typeof val === 'string') {
    const date = new Date(val);
    if (!isNaN(date.getTime())) return date;
  }
  
  return null;
}

// ============================================
// ACTUALIZAR KPIs
// ============================================

function updateKPIs() {
  const totalInvertido = state.activos.reduce((sum, a) => sum + a.inversion, 0);
  const totalActual = state.activos.reduce((sum, a) => sum + a.valorActual, 0);
  const totalPL = totalActual - totalInvertido;
  const totalPLPercent = totalInvertido > 0 ? (totalPL / totalInvertido) * 100 : 0;
  
  const numActivos = state.activos.length;
  const numTransacciones = state.transacciones.length;
  const numExchanges = new Set(state.transacciones.map(t => t.exchange).filter(Boolean)).size;
  
  animateCounter('kpiInvertido', totalInvertido, '$');
  animateCounter('kpiActual', totalActual, '$');
  animateCounter('kpiPL', totalPL, '$', totalPL >= 0);
  animateCounter('kpiActivos', numActivos, '');
  animateCounter('kpiTransacciones', numTransacciones, '');
  animateCounter('kpiExchanges', numExchanges, '');
  
  document.getElementById('kpiPLPercent').textContent = totalPLPercent.toFixed(2) + '%';
  document.getElementById('kpiPLPercent').style.color = totalPL >= 0 ? 'var(--ok)' : 'var(--bad)';
}

function animateCounter(id, value, prefix = '', isPositive = null) {
  const el = document.getElementById(id);
  const duration = 1500;
  const start = parseFloat(el.dataset.value || 0);
  const end = value;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);
    const current = start + (end - start) * eased;
    
    let formatted = prefix + formatNumber(current);
    if (isPositive !== null) {
      formatted = (end >= 0 ? '+' : '') + formatted;
      el.style.color = end >= 0 ? 'var(--ok)' : 'var(--bad)';
    }
    
    el.textContent = formatted;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.dataset.value = end;
    }
  }
  
  requestAnimationFrame(update);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function formatNumber(num) {
  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  } else {
    return num.toFixed(2);
  }
}

// ============================================
// RENDERIZAR GRÁFICOS
// ============================================

function renderCharts() {
  renderPriceChart();
  renderPortfolioCurveChart();
  renderPLChart();
  renderDrawdownChart();
  renderPortfolioChart();
  renderBubbleChart();
}

// 1. Gráfico de Evolución de Precios
function renderPriceChart() {
  const ctx = document.getElementById('priceChart');
  if (!ctx) return;
  
  if (state.charts.priceChart) {
    state.charts.priceChart.destroy();
  }
  
  // Generar datos de ejemplo (en producción, usar datos reales de _Hist_Precios)
  const datasets = state.activos.slice(0, 5).map(activo => {
    const data = generateMockPriceHistory(activo);
    return {
      label: activo.nombre,
      data: data,
      borderColor: activo.color,
      backgroundColor: activo.color + '20',
      borderWidth: 3,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      fill: false
    };
  });
  
  state.charts.priceChart = new Chart(ctx, {
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
          labels: {
            color: 'var(--text)',
            font: { size: 11, weight: '700' },
            padding: 12,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'var(--border)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: (context) => {
              return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            displayFormats: { day: 'MMM dd' }
          },
          grid: {
            color: 'var(--grid)',
            drawBorder: false
          },
          ticks: {
            color: 'var(--tick)',
            font: { size: 10 }
          }
        },
        y: {
          grid: {
            color: 'var(--grid)',
            drawBorder: false
          },
          ticks: {
            color: 'var(--tick)',
            font: { size: 10 },
            callback: (value) => '$' + value.toFixed(0)
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}

// 2. Curva del Portafolio
function renderPortfolioCurveChart() {
  const ctx = document.getElementById('portfolioCurveChart');
  if (!ctx) return;
  
  if (state.charts.portfolioCurveChart) {
    state.charts.portfolioCurveChart.destroy();
  }
  
  // Generar datos acumulados
  const data = generatePortfolioCurveData();
  
  state.charts.portfolioCurveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Invertido',
          data: data.invertido,
          borderColor: '#7a47f3',
          backgroundColor: 'rgba(122,71,243,0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true
        },
        {
          label: 'Valor',
          data: data.valor,
          borderColor: '#4dd6ff',
          backgroundColor: 'rgba(77,214,255,0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true
        }
      ]
    },
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
          labels: {
            color: 'var(--text)',
            font: { size: 11, weight: '700' },
            padding: 12,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          callbacks: {
            label: (context) => {
              return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'var(--grid)', drawBorder: false },
          ticks: { color: 'var(--tick)', font: { size: 10 } }
        },
        y: {
          grid: { color: 'var(--grid)', drawBorder: false },
          ticks: {
            color: 'var(--tick)',
            font: { size: 10 },
            callback: (value) => '$' + value.toFixed(0)
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}

// 3. Ganancia/Pérdida por Activo
function renderPLChart() {
  const ctx = document.getElementById('plChart');
  if (!ctx) return;
  
  if (state.charts.plChart) {
    state.charts.plChart.destroy();
  }
  
  const labels = state.activos.map(a => a.simbolo);
  const data = state.activos.map(a => a.profitLoss);
  const colors = state.activos.map(a => a.profitLoss >= 0 ? '#34d399' : '#fb7185');
  
  state.charts.plChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'P&L (USDT)',
        data: data,
        backgroundColor: colors,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          callbacks: {
            label: (context) => {
              const value = context.parsed.y;
              return (value >= 0 ? '+' : '') + '$' + value.toFixed(2);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'var(--tick)', font: { size: 11, weight: '700' } }
        },
        y: {
          grid: { color: 'var(--grid)', drawBorder: false },
          ticks: {
            color: 'var(--tick)',
            font: { size: 10 },
            callback: (value) => '$' + value.toFixed(0)
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}

// 4. Drawdown del Portafolio
function renderDrawdownChart() {
  const ctx = document.getElementById('drawdownChart');
  if (!ctx) return;
  
  if (state.charts.drawdownChart) {
    state.charts.drawdownChart.destroy();
  }
  
  // Generar datos de drawdown simulados
  const data = generateDrawdownData();
  
  state.charts.drawdownChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Drawdown %',
        data: data.values,
        borderColor: '#fb7185',
        backgroundColor: 'rgba(251,113,133,0.2)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          callbacks: {
            label: (context) => {
              return 'Drawdown: ' + context.parsed.y.toFixed(2) + '%';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'var(--grid)', drawBorder: false },
          ticks: { color: 'var(--tick)', font: { size: 10 } }
        },
        y: {
          reverse: true,
          grid: { color: 'var(--grid)', drawBorder: false },
          ticks: {
            color: 'var(--tick)',
            font: { size: 10 },
            callback: (value) => value.toFixed(1) + '%'
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}

// 5. Distribución del Portafolio (Donut)
function renderPortfolioChart() {
  const ctx = document.getElementById('portfolioChart');
  if (!ctx) return;
  
  if (state.charts.portfolioChart) {
    state.charts.portfolioChart.destroy();
  }
  
  const labels = state.activos.map(a => a.nombre);
  const data = state.activos.map(a => a.porcentajePortafolio);
  const colors = state.activos.map(a => a.color);
  
  state.charts.portfolioChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            color: 'var(--text)',
            font: { size: 11, weight: '700' },
            padding: 12,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          callbacks: {
            label: (context) => {
              return context.label + ': ' + context.parsed.toFixed(2) + '%';
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}

// 6. Mapa de Cartera (Bubble)
function renderBubbleChart() {
  const ctx = document.getElementById('bubbleChart');
  if (!ctx) return;
  
  if (state.charts.bubbleChart) {
    state.charts.bubbleChart.destroy();
  }
  
  const datasets = state.activos.map(activo => ({
    label: activo.nombre,
    data: [{
      x: activo.porcentajePortafolio,
      y: activo.roi,
      r: Math.sqrt(activo.valorActual) * 2
    }],
    backgroundColor: activo.color + '80',
    borderColor: activo.color,
    borderWidth: 2
  }));
  
  state.charts.bubbleChart = new Chart(ctx, {
    type: 'bubble',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: 'var(--text)',
            font: { size: 10, weight: '700' },
            padding: 8,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          callbacks: {
            label: (context) => {
              const activo = state.activos[context.datasetIndex];
              return [
                activo.nombre,
                'Portafolio: ' + context.parsed.x.toFixed(2) + '%',
                'ROI: ' + context.parsed.y.toFixed(2) + '%',
                'Valor: $' + activo.valorActual.toFixed(2)
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '% del portafolio',
            color: 'var(--text)',
            font: { size: 11, weight: '700' }
          },
          grid: { color: 'var(--grid)', drawBorder: false },
          ticks: {
            color: 'var(--tick)',
            font: { size: 10 },
            callback: (value) => value.toFixed(0) + '%'
          }
        },
        y: {
          title: {
            display: true,
            text: 'ROI %',
            color: 'var(--text)',
            font: { size: 11, weight: '700' }
          },
          grid: { color: 'var(--grid)', drawBorder: false },
          ticks: {
            color: 'var(--tick)',
            font: { size: 10 },
            callback: (value) => value.toFixed(0) + '%'
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}

// ============================================
// RENDERIZAR WATCHLIST
// ============================================

function renderWatchlist() {
  const container = document.getElementById('watchlist');
  if (!container) return;
  
  container.innerHTML = '';
  
  state.activos.forEach(activo => {
    const item = document.createElement('div');
    item.className = 'watchlist-item';
    item.style.opacity = '0';
    item.style.transform = 'translateY(20px)';
    
    const isPositive = activo.profitLoss >= 0;
    
    item.innerHTML = `
      <div class="watchlist-icon" style="background: ${activo.color}20; color: ${activo.color};">
        ${activo.icon}
      </div>
      <div class="watchlist-info">
        <div class="watchlist-name">${activo.nombre} • ${activo.porcentajePortafolio.toFixed(2)}%</div>
        <div class="watchlist-details">
          Inv. USDT ${activo.inversion.toFixed(2)} • Val. USDT ${activo.valorActual.toFixed(2)} • Spot...
        </div>
      </div>
      <div class="watchlist-value">
        <div class="watchlist-amount ${isPositive ? 'positive' : 'negative'}">
          ${isPositive ? '+' : ''}USDT<br>${Math.abs(activo.profitLoss).toFixed(2)}
        </div>
        <div class="watchlist-change ${isPositive ? 'positive' : 'negative'}">
          ${isPositive ? '+' : ''}${activo.roi.toFixed(2)}%
        </div>
      </div>
    `;
    
    container.appendChild(item);
    
    // Animar entrada
    setTimeout(() => {
      item.style.transition = 'all 0.5s ease';
      item.style.opacity = '1';
      item.style.transform = 'translateY(0)';
    }, 50 * state.activos.indexOf(activo));
  });
}

// ============================================
// RENDERIZAR TABLA
// ============================================

function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  state.activos.forEach(activo => {
    const row = document.createElement('tr');
    const isPositive = activo.profitLoss >= 0;
    
    row.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: ${activo.color}20; color: ${activo.color}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px;">
            ${activo.icon}
          </div>
          <div>
            <div style="font-weight: 800; font-size: 13px;">${activo.nombre}</div>
            <div style="font-size: 11px; color: var(--text-secondary);">${activo.porcentajePortafolio.toFixed(2)}%</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight: 700;">USDT</div>
        <div style="font-size: 13px; font-weight: 800;">${activo.inversion.toFixed(2)}</div>
      </td>
      <td>
        <div style="font-weight: 700;">USDT</div>
        <div style="font-size: 13px; font-weight: 800;">${activo.valorActual.toFixed(2)}</div>
      </td>
      <td>
        <div style="font-weight: 700; color: ${isPositive ? 'var(--ok)' : 'var(--bad)'};">
          ${isPositive ? '+' : ''}USDT
        </div>
        <div style="font-size: 13px; font-weight: 800; color: ${isPositive ? 'var(--ok)' : 'var(--bad)'};">
          ${activo.profitLoss.toFixed(2)}
        </div>
      </td>
      <td>
        <div style="font-size: 15px; font-weight: 800; color: ${isPositive ? 'var(--ok)' : 'var(--bad)'};">
          ${isPositive ? '+' : ''}${activo.roi.toFixed(2)}%
        </div>
      </td>
      <td>
        <div style="font-weight: 700;">USD</div>
        <div style="font-size: 13px; font-weight: 800;">-</div>
      </td>
    `;
    
    tbody.appendChild(row);
  });
}

// ============================================
// FUNCIONES AUXILIARES PARA DATOS SIMULADOS
// ============================================

function generateMockPriceHistory(activo) {
  const data = [];
  const now = new Date();
  const days = 120;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Simular precio basado en ROI actual
    const basePrice = 1000;
    const variation = (Math.random() - 0.5) * 200;
    const trend = (activo.roi / 100) * (days - i) / days * basePrice;
    
    data.push({
      x: date,
      y: basePrice + trend + variation
    });
  }
  
  return data;
}

function generatePortfolioCurveData() {
  const labels = [];
  const invertido = [];
  const valor = [];
  
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  const totalInv = state.activos.reduce((sum, a) => sum + a.inversion, 0);
  const totalVal = state.activos.reduce((sum, a) => sum + a.valorActual, 0);
  
  for (let i = 0; i < months.length; i++) {
    labels.push(months[i]);
    const progress = (i + 1) / months.length;
    invertido.push(totalInv * progress);
    valor.push((totalInv + (totalVal - totalInv) * progress) * (0.9 + Math.random() * 0.2));
  }
  
  return { labels, invertido, valor };
}

function generateDrawdownData() {
  const labels = [];
  const values = [];
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  
  for (let i = 0; i < months.length; i++) {
    labels.push(months[i]);
    values.push(Math.random() * -10); // Drawdown siempre negativo
  }
  
  return { labels, values };
}

// ============================================
// UTILIDADES
// ============================================

function updateStatus(text, status) {
  const pill = document.getElementById('statusPill');
  const statusText = document.getElementById('statusText');
  
  pill.className = 'pill';
  if (status === 'online') pill.classList.add('online');
  if (status === 'offline') pill.classList.add('offline');
  
  statusText.textContent = text;
}

function formatTime(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // segundos
  
  if (diff < 60) return 'hace unos segundos';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} minuto${Math.floor(diff / 60) > 1 ? 's' : ''}`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} hora${Math.floor(diff / 3600) > 1 ? 's' : ''}`;
  return `hace ${Math.floor(diff / 86400)} día${Math.floor(diff / 86400) > 1 ? 's' : ''}`;
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  document.getElementById('themeIcon').textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('themeIcon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

function refreshData() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  btn.style.opacity = '0.6';
  
  loadData().finally(() => {
    setTimeout(() => {
      btn.disabled = false;
      btn.style.opacity = '1';
    }, 1000);
  });
}

function setupAutoRefresh() {
  if (state.autoRefreshInterval) {
    clearInterval(state.autoRefreshInterval);
  }
  
  state.autoRefreshInterval = setInterval(() => {
    console.log('🔄 Auto-refresh activado');
    loadData();
  }, DASHBOARD_CONFIG.AUTO_REFRESH_INTERVAL);
}

function sortWatchlist() {
  alert('Funcionalidad de ordenamiento próximamente');
}

// Exportar funciones globales
window.toggleTheme = toggleTheme;
window.refreshData = refreshData;
window.sortWatchlist = sortWatchlist;
