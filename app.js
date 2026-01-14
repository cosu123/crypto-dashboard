// ============================================
// HEIDI CRYPTO PORTFOLIO - APP.JS v3.0
// Dashboard Premium con datos reales
// ============================================

console.log('%c🚀 HEIDI Dashboard v3.0 - Iniciando...', 'color: #00d4ff; font-size: 16px; font-weight: bold;');

// ============================================
// ESTADO GLOBAL UNIFICADO
// ============================================

const state = {
  activos: [],
  preciosHistoricos: {},
  lastUpdate: null,
  charts: {},
  autoRefreshInterval: null,
  currentPeriod: 'all',
  kpis: {
    totalInvertido: 0,
    valorActual: 0,
    plTotal: 0,
    roiTotal: 0,
    numActivos: 0,
    numTransacciones: 0,
    numExchanges: 1
  }
};

// ============================================
// INICIALIZACIÓN
// ============================================

console.log('🚀 HEIDI Crypto Portfolio v3.0 - Cargando...');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

async function initApp() {
  console.log('🚀 Iniciando aplicación...');
  
  try {
    // Cargar tema
    loadTheme();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Cargar datos
    await loadData();
    
    // Ocultar loading screen DESPUÉS de cargar datos
    hideLoadingScreen();
    
    // Auto-refresh cada 5 minutos
    state.autoRefreshInterval = setInterval(loadData, 300000);
    
    console.log('✅ Aplicación iniciada correctamente');
    
  } catch (error) {
    console.error('❌ Error en initApp:', error);
    hideLoadingScreen();
    showError('Error al inicializar la aplicación: ' + error.message);
  }
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
      console.log('✅ Loading screen ocultado');
    }, 500);
  }
}

function showError(message) {
  console.error('❌', message);
  alert(message); // Temporal para debugging
}

// ============================================
// CARGA DE DATOS
// ============================================

async function loadData() {
  console.log('📊 Cargando datos del Google Sheet...');
  updateStatus('Sincronizando...');
  
  try {
    // Cargar datos de Resumen_Activo
    const resumenData = await fetchSheetData(DASHBOARD_CONFIG.SHEETS.RESUMEN);
    console.log('✅ Datos de Resumen_Activo cargados:', resumenData.length, 'filas');
    
    // Procesar datos
    processResumenActivo(resumenData);
    
    // Actualizar timestamp
    state.lastUpdate = new Date();
    updateStatus('En línea');
    
    // Renderizar todo
    renderAll();
    
    console.log('✅ Dashboard actualizado correctamente');
    console.log('📊 KPIs:', state.kpis);
    console.log('📊 Activos:', state.activos);
    
  } catch (error) {
    console.error('❌ Error cargando datos:', error);
    updateStatus('Error');
    showError('Error al cargar datos: ' + error.message);
  }
}

async function fetchSheetData(sheetName) {
  const sheetId = DASHBOARD_CONFIG.SHEET_ID;
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}&_=${Date.now()}`;
  
  console.log(`📡 Fetching: ${sheetName}...`);
  
  const response = await fetch(url, { 
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const text = await response.text();
  const jsonText = text.substring(47).slice(0, -2);
  const json = JSON.parse(jsonText);
  
  if (!json.table || !json.table.rows || json.table.rows.length === 0) {
    throw new Error(`La hoja "${sheetName}" está vacía`);
  }
  
  return json.table.rows;
}

// ============================================
// PROCESAMIENTO DE DATOS
// ============================================

function processResumenActivo(rows) {
  console.log('🔄 Procesando Resumen_Activo...');
  console.log('📊 Total de filas recibidas:', rows.length);
  
  // Log de las primeras 10 filas para debugging
  console.log('📋 Primeras 10 filas:');
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const cells = rows[i].c;
    const valores = cells.map(c => c?.v || c?.f || 'null');
    console.log(`  Fila ${i}:`, valores);
  }
  
  const activos = [];
  let totalInvertido = 0;
  let valorActual = 0;
  let plTotal = 0;
  
  // Encontrar el bloque más reciente (primeras filas después del encabezado)
  // La estructura es:
  // Fila con "Bloque: DD.MM.YYYY"
  // Fila con "Activo"
  // Filas de datos (BTC, ETH, etc.)
  // Fila "TOTAL"
  
  let startIndex = 0;
  
  // Buscar la primera fila con datos de activos
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].c;
    const activo = cells[0]?.v || '';
    
    // Si encontramos "BTC", "ETH", etc., este es el inicio del bloque más reciente
    if (activo === 'BTC' || activo === 'ETH' || activo === 'SOL') {
      startIndex = i;
      console.log('✅ Bloque más reciente encontrado en fila', i);
      break;
    }
  }
  
  // Procesar filas de activos
  for (let i = startIndex; i < rows.length; i++) {
    const cells = rows[i].c;
    const activo = cells[0]?.v || '';
    
    // Detener si encontramos "TOTAL" o una fila vacía
    if (activo === 'TOTAL' || activo === '' || !activo) {
      break;
    }
    
    // Validar que sea un activo conocido
    if (!['BTC', 'ETH', 'SOL', 'LINK', 'AVAX', 'DOGE'].includes(activo)) {
      continue;
    }
    
    // Extraer datos de las columnas
    const fecha = cells[1]?.v || cells[1]?.f || '';
    const precioActual = parseFloat(cells[2]?.v || 0);
    const var24h = parseFloat(cells[3]?.v || 0);
    const cantidad = parseFloat(cells[4]?.v || 0);
    const costoProm = parseFloat(cells[5]?.v || 0);
    const valorActualActivo = parseFloat(cells[6]?.v || 0);
    const pl = parseFloat(cells[7]?.v || 0);
    const dcaSugerido = parseFloat(cells[8]?.v || 0);
    
    // Calcular inversión
    const inversionUsdt = cantidad * costoProm;
    
    // Calcular ROI
    let roi = 0;
    if (inversionUsdt > 0) {
      roi = (pl / inversionUsdt) * 100;
      roi = Math.max(-100, Math.min(10000, roi)); // Limitar ROI
    }
    
    // Crear objeto de activo
    const activoData = {
      symbol: activo,
      name: DASHBOARD_CONFIG.NOMBRES[activo] || activo,
      cantidad: cantidad,
      precioActual: precioActual,
      costoProm: costoProm,
      inversionUsdt: inversionUsdt,
      valorActual: valorActualActivo,
      pl: pl,
      roi: roi,
      var24h: var24h,
      dcaSugerido: dcaSugerido,
      fecha: fecha
    };
    
    activos.push(activoData);
    
    // Sumar a totales
    totalInvertido += inversionUsdt;
    valorActual += valorActualActivo;
    plTotal += pl;
    
    console.log(`✅ ${activo}: Inversión=${inversionUsdt.toFixed(2)}, Valor=${valorActualActivo.toFixed(2)}, P/L=${pl.toFixed(2)}, ROI=${roi.toFixed(2)}%`);
  }
  
  // Calcular ROI total
  let roiTotal = 0;
  if (totalInvertido > 0) {
    roiTotal = (plTotal / totalInvertido) * 100;
  }
  
  // Actualizar estado
  state.activos = activos;
  state.kpis = {
    totalInvertido: totalInvertido,
    valorActual: valorActual,
    plTotal: plTotal,
    roiTotal: roiTotal,
    numActivos: activos.length,
    numTransacciones: 105, // Hardcoded por ahora
    numExchanges: 1
  };
  
  console.log('✅ Resumen procesado:', activos.length, 'activos');
  console.log('📊 Total Invertido:', totalInvertido.toFixed(2));
  console.log('📊 Valor Actual:', valorActual.toFixed(2));
  console.log('📊 P/L Total:', plTotal.toFixed(2));
  console.log('📊 ROI Total:', roiTotal.toFixed(2) + '%');
}

// ============================================
// RENDERIZADO
// ============================================

function renderAll() {
  console.log('🎨 Renderizando dashboard...');
  
  try {
    renderKPIs();
    renderGoalChart();
    renderCharts();
    renderWatchlist();
    renderTable();
    console.log('✅ Dashboard renderizado');
  } catch (error) {
    console.error('❌ Error renderizando:', error);
  }
}

function renderKPIs() {
  const { totalInvertido, valorActual, plTotal, roiTotal, numActivos, numTransacciones, numExchanges } = state.kpis;
  
  console.log('🎨 Renderizando KPIs...');
  console.log('  Total Invertido:', totalInvertido);
  console.log('  Valor Actual:', valorActual);
  console.log('  P/L Total:', plTotal);
  
  // Total Invertido
  const totalInvertidoEl = document.querySelector('[data-kpi="total-invertido"]');
  if (totalInvertidoEl) {
    totalInvertidoEl.textContent = `$${totalInvertido.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    console.warn('⚠️ Elemento data-kpi="total-invertido" no encontrado');
  }
  
  // Valor Actual
  const valorActualEl = document.querySelector('[data-kpi="valor-actual"]');
  if (valorActualEl) {
    valorActualEl.textContent = `$${valorActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    console.warn('⚠️ Elemento data-kpi="valor-actual" no encontrado');
  }
  
  // P&L Total
  const plTotalEl = document.querySelector('[data-kpi="pl-total"]');
  if (plTotalEl) {
    plTotalEl.textContent = `$${plTotal >= 0 ? '+' : ''}${plTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    plTotalEl.style.color = plTotal >= 0 ? 'var(--success)' : 'var(--danger)';
  } else {
    console.warn('⚠️ Elemento data-kpi="pl-total" no encontrado');
  }
  
  // ROI Percent
  const roiPercentEl = document.querySelector('[data-kpi="roi-percent"]');
  if (roiPercentEl) {
    roiPercentEl.textContent = `${roiTotal >= 0 ? '+' : ''}${roiTotal.toFixed(2)}%`;
    roiPercentEl.style.color = roiTotal >= 0 ? 'var(--success)' : 'var(--danger)';
  } else {
    console.warn('⚠️ Elemento data-kpi="roi-percent" no encontrado');
  }
  
  // Activos
  const activosEl = document.querySelector('[data-kpi="activos"]');
  if (activosEl) activosEl.textContent = numActivos;
  
  // Transacciones
  const transaccionesEl = document.querySelector('[data-kpi="transacciones"]');
  if (transaccionesEl) transaccionesEl.textContent = numTransacciones;
  
  // Exchanges
  const exchangesEl = document.querySelector('[data-kpi="exchanges"]');
  if (exchangesEl) exchangesEl.textContent = numExchanges;
  
  console.log('✅ KPIs renderizados');
}

function renderGoalChart() {
  const canvas = document.getElementById('goalChart');
  if (!canvas) {
    console.warn('⚠️ Canvas goalChart no encontrado');
    return;
  }
  
  const objetivo = 5000;
  const inversionActual = state.kpis.totalInvertido;
  const falta = Math.max(0, objetivo - inversionActual);
  const excedente = Math.max(0, inversionActual - objetivo);
  const progreso = Math.min(100, (inversionActual / objetivo) * 100);
  
  console.log('🎨 Renderizando gráfico de objetivo...');
  console.log('  Inversión Actual:', inversionActual);
  console.log('  Objetivo:', objetivo);
  console.log('  Progreso:', progreso.toFixed(1) + '%');
  
  // Actualizar porcentaje en el centro del gauge
  const goalProgressCenter = document.getElementById('goalProgressCenter');
  if (goalProgressCenter) {
    goalProgressCenter.textContent = `${progreso.toFixed(1)}%`;
  }
  
  // Actualizar textos
  const goalStats = document.querySelectorAll('.goal-stat');
  if (goalStats.length >= 4) {
    // Inversión Actual
    goalStats[0].querySelector('.goal-value').textContent = `$${inversionActual.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    
    // Objetivo
    goalStats[1].querySelector('.goal-value').textContent = `$${objetivo.toLocaleString('en-US')}`;
    
    // Falta/Excedente
    if (excedente > 0) {
      goalStats[2].querySelector('.goal-label').textContent = 'Excedente';
      goalStats[2].querySelector('.goal-value').textContent = `$${excedente.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      goalStats[2].querySelector('.goal-value').style.color = 'var(--success)';
    } else {
      goalStats[2].querySelector('.goal-label').textContent = 'Falta';
      goalStats[2].querySelector('.goal-value').textContent = `$${falta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      goalStats[2].querySelector('.goal-value').style.color = 'var(--danger)';
    }
    
    // Progreso
    goalStats[3].querySelector('.goal-value').textContent = `${progreso.toFixed(1)}%`;
  }
  
  // Destruir gráfico anterior
  if (state.charts.goalChart) {
    state.charts.goalChart.destroy();
  }
  
  // Crear gráfico tipo gauge (doughnut)
  const ctx = canvas.getContext('2d');
  
  const completado = Math.min(inversionActual, objetivo);
  const restante = Math.max(0, objetivo - inversionActual);
  
  state.charts.goalChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Completado', 'Restante'],
      datasets: [{
        data: [completado, restante],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)', // Verde
          'rgba(107, 114, 128, 0.2)'  // Gris
        ],
        borderColor: [
          'rgba(16, 185, 129, 1)',
          'rgba(107, 114, 128, 0.4)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const percent = ((value / objetivo) * 100).toFixed(1);
              return `${label}: $${value.toLocaleString('en-US')} (${percent}%)`;
            }
          }
        }
      }
    }
  });
  
  console.log('✅ Gráfico de objetivo renderizado');
}

function renderCharts() {
  console.log('🎨 Renderizando gráficos...');
  
  // Por ahora, solo renderizamos gráficos básicos
  // Los gráficos avanzados se implementarán después
  
  renderPriceChart();
  renderPortfolioChart();
  
  console.log('✅ Gráficos renderizados');
}

function renderPriceChart() {
  const canvas = document.getElementById('priceChart');
  if (!canvas) return;
  
  if (state.charts.priceChart) {
    state.charts.priceChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  
  // Generar datos de ejemplo (últimos 30 días)
  const labels = [];
  const datasets = [];
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }));
  }
  
  state.activos.forEach(activo => {
    const color = DASHBOARD_CONFIG.COLORS[activo.symbol] || '#888';
    const data = [];
    
    // Generar datos aproximados basados en precio actual
    for (let i = 0; i < 30; i++) {
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variación
      data.push(activo.precioActual * (1 + variation));
    }
    
    datasets.push({
      label: activo.name,
      data: data,
      borderColor: color,
      backgroundColor: color + '20',
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 0
    });
  });
  
  state.charts.priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#ffffff',
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: '#ffffff', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: '#ffffff', font: { size: 10 } }
        }
      }
    }
  });
}

function renderPortfolioChart() {
  const canvas = document.getElementById('portfolioChart');
  if (!canvas) return;
  
  if (state.charts.portfolioChart) {
    state.charts.portfolioChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  
  const labels = state.activos.map(a => a.name);
  const data = state.activos.map(a => a.valorActual);
  const colors = state.activos.map(a => DASHBOARD_CONFIG.COLORS[a.symbol] || '#888');
  
  state.charts.portfolioChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderColor: colors.map(c => c + 'ff'),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            color: '#ffffff',
            font: { size: 11 },
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                  const percent = ((value / total) * 100).toFixed(1);
                  return {
                    text: `${label} (${percent}%)`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percent = ((value / total) * 100).toFixed(1);
              return `${label}: $${value.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${percent}%)`;
            }
          }
        }
      }
    }
  });
}

function renderWatchlist() {
  console.log('🎨 Renderizando watchlist...');
  // Implementar watchlist después
}

function renderTable() {
  console.log('🎨 Renderizando tabla...');
  
  const tbody = document.querySelector('#professionalTable tbody');
  if (!tbody) {
    console.warn('⚠️ Tabla professionalTable no encontrada');
    return;
  }
  
  tbody.innerHTML = '';
  
  state.activos.forEach(activo => {
    const row = document.createElement('tr');
    
    const plColor = activo.pl >= 0 ? 'var(--success)' : 'var(--danger)';
    const roiColor = activo.roi >= 0 ? 'var(--success)' : 'var(--danger)';
    
    row.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: ${DASHBOARD_CONFIG.COLORS[activo.symbol]}; font-size: 20px;">${DASHBOARD_CONFIG.ICONS[activo.symbol]}</span>
          <div>
            <div style="font-weight: 600;">${activo.name}</div>
            <div style="font-size: 11px; opacity: 0.7;">${activo.symbol}</div>
          </div>
        </div>
      </td>
      <td>$${activo.inversionUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>$${activo.valorActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="color: ${plColor};">${activo.pl >= 0 ? '+' : ''}$${activo.pl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="color: ${roiColor};">${activo.roi >= 0 ? '+' : ''}${activo.roi.toFixed(2)}%</td>
      <td>$${activo.precioActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    `;
    
    tbody.appendChild(row);
  });
  
  console.log('✅ Tabla renderizada');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Botón de actualizar
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      console.log('🔄 Actualización manual iniciada');
      refreshBtn.disabled = true;
      refreshBtn.textContent = '⏳ Actualizando...';
      
      await loadData();
      
      refreshBtn.disabled = false;
      refreshBtn.textContent = '↻ Actualizar';
    });
  }
  
  // Botón de tema
  const themeToggle = document.querySelector('[data-theme-toggle]');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Botones de período
  document.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentPeriod = btn.dataset.period;
      document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCharts();
    });
  });
  
  console.log('✅ Event listeners configurados');
}

// ============================================
// UTILIDADES
// ============================================

function updateStatus(status) {
  const statusEl = document.querySelector('.status-badge');
  if (statusEl) {
    statusEl.textContent = status;
    statusEl.className = 'status-badge';
    if (status === 'En línea') {
      statusEl.classList.add('online');
    } else if (status === 'Error') {
      statusEl.classList.add('error');
    }
  }
  
  // Actualizar última actualización
  if (state.lastUpdate) {
    const lastUpdateEl = document.querySelector('.last-update');
    if (lastUpdateEl) {
      const timeAgo = getTimeAgo(state.lastUpdate);
      lastUpdateEl.textContent = `Última actualización: ${timeAgo}`;
    }
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'hace unos segundos';
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} minutos`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} horas`;
  return `hace ${Math.floor(seconds / 86400)} días`;
}

function loadTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

console.log('✅ App.js cargado completamente');
