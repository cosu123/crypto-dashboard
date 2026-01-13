// ============================================
// ESTADO GLOBAL
// ============================================

const state = {
  activos: [],
  transacciones: [],
  preciosHistoricos: [],
  lastUpdate: null,
  charts: {},
  autoRefreshInterval: null,
  currentPeriod: 'all' // all, 30d, 7d
};

// Inicializar app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

console.log('🚀 Script cargado - HEIDI Crypto Portfolio');

async function initApp() {
  console.log('🚀 Iniciando aplicación...');
  
  try {
    // Cargar tema guardado
    loadTheme();
    console.log('✅ Tema cargado');
    
    // Configurar event listeners
    setupEventListeners();
    console.log('✅ Event listeners configurados');
    
    // Cargar datos
    await loadData();
    console.log('✅ Datos cargados');
    
    // Ocultar loading screen
    setTimeout(() => {
      const loadingScreen = document.getElementById('loadingScreen');
      if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
          loadingScreen.style.display = 'none';
          console.log('✅ Loading screen ocultado');
        }, 500);
      }
    }, 500);
    
    // Configurar auto-refresh
    state.autoRefreshInterval = setInterval(loadData, DASHBOARD_CONFIG.AUTO_REFRESH_INTERVAL);
    console.log('✅ Auto-refresh configurado');
    
  } catch (error) {
    console.error('❌ Error en initApp:', error);
    // Ocultar loading screen incluso si hay error
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
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
    const sheetName = DASHBOARD_CONFIG.SHEETS.RESUMEN; // Usar Resumen_Activo
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
    processResumenActivo(json);
    console.log('✅ Datos procesados:', state.activos);
    
    // Actualizar UI
    console.log('📊 Actualizando KPIs...');
    updateKPIs();
    
    console.log('📈 Renderizando gráficos...');
    renderCharts();
    
    console.log('🎯 Renderizando gráfico de objetivo...');
    renderGoalChart();
    
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
  }
}

function processResumenActivo(json) {
  const rows = json.table.rows;
  
  // Encontrar el bloque más reciente (última fecha)
  let bloqueActual = [];
  let fechaActual = null;
  
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const cells = row.c;
    
    if (!cells || cells.length < 8) continue;
    
    const activo = cells[0]?.v;
    const fecha = cells[1]?.v;
    
    // Si encontramos una fecha y es diferente, significa que cambiamos de bloque
    if (fecha && fecha !== fechaActual) {
      if (bloqueActual.length > 0) {
        // Ya tenemos un bloque completo, procesarlo
        break;
      }
      fechaActual = fecha;
    }
    
    // Agregar fila al bloque actual si tiene activo válido
    if (activo && activo !== 'TOTAL' && activo !== 'Activo') {
      // Validar que los valores numéricos sean válidos
      const precioActual = parseFloat(cells[2]?.v) || 0;
      const valorActual = parseFloat(cells[6]?.v) || 0;
      const pl = parseFloat(cells[7]?.v) || 0;
      
      // Solo agregar si tiene datos válidos (precio > 0 o valor > 0)
      if (precioActual > 0 || valorActual > 0) {
        bloqueActual.unshift({
          activo: activo,
          fecha: fecha,
          precioActual: precioActual,
          var24h: parseFloat(cells[3]?.v) || 0,
          cantidad: parseFloat(cells[4]?.v) || 0,
          costoProm: parseFloat(cells[5]?.v) || 0,
          valorActual: Math.max(0, valorActual), // Asegurar que sea positivo
          pl: pl,
          dcaSugerido: parseFloat(cells[8]?.v) || 0
        });
      }
    }
  }
  
  console.log('📦 Bloque actual encontrado:', bloqueActual);
  
  // Procesar activos
  state.activos = bloqueActual.map(item => {
    const inversion = Math.max(0, item.valorActual - item.pl);
    let roi = 0;
    
    // Calcular ROI solo si la inversión es válida y razonable
    if (inversion > 0 && inversion < 1000000) { // Validar que no sea absurdo
      roi = (item.pl / inversion) * 100;
      // Limitar ROI a un rango razonable (-100% a +10000%)
      roi = Math.max(-100, Math.min(10000, roi));
    }
    
    return {
      simbolo: item.activo,
      nombre: DASHBOARD_CONFIG.NOMBRES[item.activo] || item.activo,
      color: DASHBOARD_CONFIG.COLORS[item.activo] || '#888',
      icono: DASHBOARD_CONFIG.ICONS[item.activo] || '●',
      cantidad: item.cantidad,
      precioActual: item.precioActual,
      costoProm: item.costoProm,
      inversion: inversion,
      valorActual: item.valorActual,
      pl: item.pl,
      roi: roi,
      porcentajePortafolio: 0 // Se calculará después
    };
  });
  
  // Calcular porcentaje del portafolio
  const valorTotal = state.activos.reduce((sum, a) => sum + a.valorActual, 0);
  state.activos.forEach(activo => {
    activo.porcentajePortafolio = valorTotal > 0 ? (activo.valorActual / valorTotal) * 100 : 0;
  });
  
  // Ordenar por valor actual (mayor a menor)
  state.activos.sort((a, b) => b.valorActual - a.valorActual);
}

// ============================================
// ACTUALIZAR KPIs
// ============================================

function updateKPIs() {
  const totalInvertido = state.activos.reduce((sum, a) => sum + a.inversion, 0);
  const valorActual = state.activos.reduce((sum, a) => sum + a.valorActual, 0);
  const plTotal = state.activos.reduce((sum, a) => sum + a.pl, 0);
  const roiTotal = totalInvertido > 0 ? (plTotal / totalInvertido) * 100 : 0;
  const numActivos = state.activos.length;
  const numTransacciones = state.transacciones.length || 105; // Placeholder
  const numExchanges = 1;
  
  // Animar valores
  animateValue('kpiInvertido', 0, totalInvertido, 1500, val => `$${formatNumber(val)}`);
  animateValue('kpiActual', 0, valorActual, 1500, val => `$${formatNumber(val)}`);
  animateValue('kpiPL', 0, plTotal, 1500, val => {
    const sign = val >= 0 ? '+' : '';
    return `${sign}$${formatNumber(val)}`;
  });
  
  // Actualizar porcentaje en el hint del KPI P&L
  const kpiPLPercent = document.getElementById('kpiPLPercent');
  if (kpiPLPercent) {
    const sign = roiTotal >= 0 ? '+' : '';
    kpiPLPercent.textContent = `${sign}${roiTotal.toFixed(2)}%`;
    kpiPLPercent.style.color = roiTotal >= 0 ? 'var(--ok)' : 'var(--bad)';
  }
  animateValue('kpiActivos', 0, numActivos, 1000, val => Math.round(val));
  animateValue('kpiTransacciones', 0, numTransacciones, 1000, val => Math.round(val));
  animateValue('kpiExchanges', 0, numExchanges, 1000, val => Math.round(val));
  
  // Actualizar color del P&L
  const kpiPL = document.getElementById('kpiPL');
  const kpiPLPct = document.getElementById('kpiPLPct');
  if (kpiPL && kpiPLPct) {
    const color = plTotal >= 0 ? 'var(--success)' : 'var(--error)';
    kpiPL.style.color = color;
    kpiPLPct.style.color = color;
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

function renderPriceChart() {
  const ctx = document.getElementById('priceChart');
  if (!ctx) return;
  
  // Destruir gráfico anterior
  if (state.charts.price) {
    state.charts.price.destroy();
  }
  
  // Generar datos de ejemplo (en producción, usar datos reales de _Hist_Precios)
  const days = getPeriodDays();
  const labels = generateDateLabels(days);
  const datasets = state.activos.slice(0, 5).map(activo => ({
    label: activo.simbolo,
    data: generatePriceData(activo.precioActual, days),
    borderColor: activo.color,
    backgroundColor: activo.color + '20',
    borderWidth: 2,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 6
  }));
  
  state.charts.price = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#ffffff', font: { size: 11 } }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#444',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: '#ffffff', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: '#ffffff',
            font: { size: 10 },
            callback: value => '$' + formatNumber(value)
          }
        }
      },
      animation: { duration: 1500, easing: 'easeOutQuart' }
    }
  });
}

function renderPortfolioCurveChart() {
  const ctx = document.getElementById('portfolioCurveChart');
  if (!ctx) return;
  
  if (state.charts.portfolioCurve) {
    state.charts.portfolioCurve.destroy();
  }
  
  const days = getPeriodDays();
  const labels = generateDateLabels(days);
  const totalInvertido = state.activos.reduce((sum, a) => sum + a.inversion, 0);
  const valorActual = state.activos.reduce((sum, a) => sum + a.valorActual, 0);
  
  state.charts.portfolioCurve = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Invertido',
          data: generateCurveData(totalInvertido, days, 0.02),
          borderColor: '#fbbf24',
          backgroundColor: '#fbbf2420',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        },
        {
          label: 'Valor',
          data: generateCurveData(valorActual, days, 0.05),
          borderColor: '#4dd6ff',
          backgroundColor: '#4dd6ff20',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#ffffff', font: { size: 11 } }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff'
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: '#ffffff', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: '#ffffff',
            font: { size: 10 },
            callback: value => '$' + formatNumber(value)
          }
        }
      },
      animation: { duration: 1500, easing: 'easeOutQuart' }
    }
  });
}

function renderPLChart() {
  const ctx = document.getElementById('plChart');
  if (!ctx) return;
  
  if (state.charts.pl) {
    state.charts.pl.destroy();
  }
  
  const labels = state.activos.map(a => a.simbolo);
  const data = state.activos.map(a => a.pl);
  const colors = data.map(val => val >= 0 ? '#34d399' : '#fb7185');
  
  state.charts.pl = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'P&L (USDT)',
        data,
        backgroundColor: colors,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: ctx => `$${formatNumber(ctx.parsed.x)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: '#ffffff',
            font: { size: 10 },
            callback: value => '$' + formatNumber(value)
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#ffffff', font: { size: 12, weight: 'bold' } }
        }
      },
      animation: { duration: 1500, easing: 'easeOutQuart' }
    }
  });
}

function renderDrawdownChart() {
  const ctx = document.getElementById('drawdownChart');
  if (!ctx) return;
  
  if (state.charts.drawdown) {
    state.charts.drawdown.destroy();
  }
  
  const days = getPeriodDays();
  const labels = generateDateLabels(days);
  const drawdownData = generateDrawdownData(days);
  
  state.charts.drawdown = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Drawdown %',
        data: drawdownData,
        borderColor: '#fb7185',
        backgroundColor: '#fb718540',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: ctx => `${ctx.parsed.y.toFixed(2)}%`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: '#ffffff', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: '#ffffff',
            font: { size: 10 },
            callback: value => value + '%'
          }
        }
      },
      animation: { duration: 1500, easing: 'easeOutQuart' }
    }
  });
}

function renderPortfolioChart() {
  const ctx = document.getElementById('portfolioChart');
  if (!ctx) return;
  
  if (state.charts.portfolio) {
    state.charts.portfolio.destroy();
  }
  
  const labels = state.activos.map(a => a.simbolo);
  const data = state.activos.map(a => a.porcentajePortafolio);
  const colors = state.activos.map(a => a.color);
  
  state.charts.portfolio = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 10
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
            color: '#ffffff',
            font: { size: 11 },
            padding: 12,
            generateLabels: chart => {
              const data = chart.data;
              return state.activos.map((activo, i) => ({
                text: `${activo.nombre} ${activo.porcentajePortafolio.toFixed(1)}%`,
                fillStyle: activo.color,
                hidden: false,
                index: i
              }));
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(2)}%`
          }
        }
      },
      animation: { duration: 1500, easing: 'easeOutQuart' }
    }
  });
}

function renderBubbleChart() {
  const ctx = document.getElementById('bubbleChart');
  if (!ctx) return;
  
  if (state.charts.bubble) {
    state.charts.bubble.destroy();
  }
  
  const data = state.activos.map(a => ({
    x: a.porcentajePortafolio,
    y: a.roi,
    r: Math.sqrt(a.valorActual) / 3,
    label: a.simbolo,
    color: a.color
  }));
  
  state.charts.bubble = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: data.map(d => ({
        label: d.label,
        data: [{ x: d.x, y: d.y, r: d.r }],
        backgroundColor: d.color + '60',
        borderColor: d.color,
        borderWidth: 2
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#ffffff', font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: ctx => {
              const d = data[ctx.datasetIndex];
              return [
                `${d.label}`,
                `% Portafolio: ${d.x.toFixed(2)}%`,
                `ROI: ${d.y.toFixed(2)}%`,
                `Valor: $${formatNumber(state.activos[ctx.datasetIndex].valorActual)}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: '#ffffff',
            font: { size: 10 },
            callback: value => value + '%'
          },
          title: {
            display: true,
            text: '% del portafolio',
            color: '#ffffff',
            font: { size: 11 }
          }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: '#ffffff',
            font: { size: 10 },
            callback: value => value + '%'
          },
          title: {
            display: true,
            text: 'ROI %',
            color: '#ffffff',
            font: { size: 11 }
          }
        }
      },
      animation: { duration: 1500, easing: 'easeOutQuart' }
    }
  });
}

// ============================================
// RENDERIZAR WATCHLIST
// ============================================

function renderGoalChart() {
  const GOAL_AMOUNT = 5000; // Objetivo de $5,000 USDT
  
  // Calcular valores
  const current = state.kpis.totalInvertido;
  const remaining = Math.max(0, GOAL_AMOUNT - current);
  const progress = Math.min(100, (current / GOAL_AMOUNT) * 100);
  
  // Actualizar textos
  const goalCurrentEl = document.getElementById('goalCurrent');
  const goalRemainingEl = document.getElementById('goalRemaining');
  const goalProgressEl = document.getElementById('goalProgress');
  
  if (goalCurrentEl) goalCurrentEl.textContent = `$${formatNumber(current)}`;
  if (goalRemainingEl) goalRemainingEl.textContent = `$${formatNumber(remaining)}`;
  if (goalProgressEl) goalProgressEl.textContent = `${progress.toFixed(1)}%`;
  
  // Renderizar gráfico de barra horizontal
  const ctx = document.getElementById('goalChart');
  if (!ctx) return;
  
  if (state.charts.goal) {
    state.charts.goal.destroy();
  }
  
  state.charts.goal = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Progreso'],
      datasets: [
        {
          label: 'Invertido',
          data: [current],
          backgroundColor: 'rgba(0, 255, 136, 0.8)',
          borderColor: 'rgba(0, 255, 136, 1)',
          borderWidth: 2,
          borderRadius: 8
        },
        {
          label: 'Falta',
          data: [remaining],
          backgroundColor: 'rgba(255, 107, 157, 0.3)',
          borderColor: 'rgba(255, 107, 157, 0.6)',
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          max: GOAL_AMOUNT,
          ticks: {
            color: '#ffffff',
            font: { size: 11 },
            callback: value => `$${value.toLocaleString()}`
          },
          grid: {
            color: 'rgba(255,255,255,0.1)',
            drawBorder: false
          }
        },
        y: {
          stacked: true,
          ticks: {
            color: '#ffffff',
            font: { size: 12, weight: '600' }
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#ffffff',
            font: { size: 11 },
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: context => {
              const label = context.dataset.label || '';
              const value = context.parsed.x;
              const percent = ((value / GOAL_AMOUNT) * 100).toFixed(1);
              return `${label}: $${formatNumber(value)} (${percent}%)`;
            }
          }
        }
      },
      animation: { duration: 1500, easing: 'easeOutQuart' }
    }
  });
}

function renderWatchlist() {
  const container = document.getElementById('watchlistItems');
  if (!container) return;
  
  container.innerHTML = state.activos.map((activo, index) => {
    const plColor = activo.pl >= 0 ? 'var(--success)' : 'var(--error)';
    const plSign = activo.pl >= 0 ? '+' : '';
    const roiSign = activo.roi >= 0 ? '+' : '';
    
    return `
      <div class="watchlist-item" style="animation-delay: ${index * 0.1}s">
        <div class="watchlist-icon" style="background: ${activo.color}20; color: ${activo.color}">
          ${activo.icono}
        </div>
        <div class="watchlist-info">
          <div class="watchlist-name">
            <strong>${activo.nombre}</strong>
            <span style="color: #888"> • ${activo.porcentajePortafolio.toFixed(1)}%</span>
          </div>
          <div class="watchlist-values">
            <span style="color: #aaa">Inv. $${formatNumber(activo.inversion)}</span>
            <span style="color: #fff">Val. $${formatNumber(activo.valorActual)}</span>
          </div>
        </div>
        <div class="watchlist-pl">
          <div style="color: ${plColor}; font-weight: 600">${plSign}$${formatNumber(activo.pl)}</div>
          <div style="color: ${plColor}; font-size: 0.9em">${roiSign}${activo.roi.toFixed(2)}%</div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// RENDERIZAR TABLA
// ============================================

function renderTable() {
  const tbody = document.querySelector('#professionalTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = state.activos.map(activo => {
    const plColor = activo.pl >= 0 ? 'var(--success)' : 'var(--error)';
    const plSign = activo.pl >= 0 ? '+' : '';
    const roiSign = activo.roi >= 0 ? '+' : '';
    
    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 8px">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${activo.color}20; color: ${activo.color}; display: flex; align-items: center; justify-content: center; font-weight: bold">
              ${activo.icono}
            </div>
            <div>
              <strong style="color: #fff">${activo.nombre}</strong>
              <div style="font-size: 0.85em; color: #888">${activo.porcentajePortafolio.toFixed(2)}%</div>
            </div>
          </div>
        </td>
        <td style="color: #fff">
          <strong>USDT</strong><br>
          <span style="color: #aaa">${formatNumber(activo.inversion)}</span>
        </td>
        <td style="color: #fff">
          <strong>USDT</strong><br>
          <span style="color: #aaa">${formatNumber(activo.valorActual)}</span>
        </td>
        <td style="color: ${plColor}">
          <strong>${plSign}USDT</strong><br>
          <span>${formatNumber(activo.pl)}</span>
        </td>
        <td style="color: ${plColor}">
          <strong>${roiSign}${activo.roi.toFixed(2)}%</strong>
        </td>
        <td style="color: #fff">
          <strong>USD</strong><br>
          <span style="color: #aaa">${formatNumber(activo.precioActual)}</span>
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

function formatNumber(num) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function formatTime(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return 'hace unos segundos';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} minutos`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

function animateValue(elementId, start, end, duration, formatter = val => val) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const startTime = performance.now();
  const range = end - start;
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = start + range * easeProgress;
    
    element.textContent = formatter(current);
    element.setAttribute('data-value', current);
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

function updateStatus(text, status) {
  const statusText = document.getElementById('statusText');
  const statusDot = document.querySelector('.status-dot');
  
  // Verificar si los datos son recientes (< 8 horas)
  if (state.lastUpdate) {
    const now = new Date();
    const diff = (now - state.lastUpdate) / 1000 / 60 / 60; // horas
    
    if (diff > 8) {
      text = 'Desconectado';
      status = 'offline';
    } else {
      text = 'En línea';
      status = 'online';
    }
  }
  
  if (statusText) statusText.textContent = text;
  if (statusDot) {
    statusDot.className = 'status-dot';
    if (status === 'online') statusDot.classList.add('online');
    else if (status === 'loading') statusDot.classList.add('loading');
    else statusDot.classList.add('offline');
  }
}

function generateDateLabels(days) {
  const labels = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }));
  }
  return labels;
}

function getPeriodDays() {
  switch (state.currentPeriod) {
    case '7d': return 7;
    case '30d': return 30;
    case 'all':
    default: return 90;
  }
}

function generatePriceData(currentPrice, days) {
  const data = [];
  let price = currentPrice * 0.85;
  for (let i = 0; i < days; i++) {
    price += (Math.random() - 0.45) * price * 0.05;
    data.push(price);
  }
  data[days - 1] = currentPrice;
  return data;
}

function generateCurveData(finalValue, days, volatility) {
  const data = [];
  let value = finalValue * 0.8;
  for (let i = 0; i < days; i++) {
    value += (Math.random() - 0.3) * value * volatility;
    data.push(value);
  }
  data[days - 1] = finalValue;
  return data;
}

function generateDrawdownData(days) {
  const data = [];
  for (let i = 0; i < days; i++) {
    data.push(-Math.random() * 15);
  }
  return data;
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Botón de actualizar
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadData();
    });
  }
  
  // Botones de período (chips)
  document.querySelectorAll('.chip[data-period]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Remover active de todos los chips del mismo grupo
      const parent = e.target.parentElement;
      parent.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // Actualizar período y re-renderizar
      state.currentPeriod = e.target.dataset.period;
      console.log('📅 Período cambiado a:', state.currentPeriod);
      renderCharts();
    });
  });
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) {
    themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  }
  
  // Re-renderizar gráficos con nuevo tema
  setTimeout(() => renderCharts(), 100);
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) {
    themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }
}

function refreshData() {
  loadData();
}
