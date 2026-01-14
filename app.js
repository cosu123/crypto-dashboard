// ============================================
// HEIDI CRYPTO PORTFOLIO - APP.JS
// Dashboard de portafolio cripto con datos reales
// ============================================

// ============================================
// ESTADO GLOBAL UNIFICADO
// ============================================

const state = {
  activos: [],
  transacciones: [],
  preciosHistoricos: {},  // mapa: activo -> [ { fecha, precio } ]
  lastUpdate: null,
  charts: {},
  autoRefreshInterval: null,
  currentPeriod: 'all',  // 'all', '30d', '7d'
  kpis: {
    totalInvertido: 0,
    valorActual: 0,
    plTotal: 0,
    roiTotal: 0,
    numActivos: 0,
    numTransacciones: 0,
    numExchanges: 0
  },
  demoMode: false
};

// ============================================
// INICIALIZACIÓN
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

console.log('🚀 Script cargado - HEIDI Crypto Portfolio v2.0');

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
      hideLoadingScreen();
    }, 500);
    
    // Configurar auto-refresh (cada 5 minutos)
    state.autoRefreshInterval = setInterval(loadData, 300000);
    console.log('✅ Auto-refresh configurado (5 min)');
    
  } catch (error) {
    console.error('❌ Error en initApp:', error);
    hideLoadingScreen();
    showError('Error al inicializar la aplicación');
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
  const errorBanner = document.getElementById('errorBanner');
  if (errorBanner) {
    errorBanner.textContent = message;
    errorBanner.style.display = 'block';
  }
  console.error('❌', message);
}

// ============================================
// CARGA DE DATOS DESDE GOOGLE SHEETS
// ============================================

async function loadData() {
  console.log('📊 Cargando datos del Google Sheet...');
  updateStatus('Sincronizando...');
  
  try {
    // Cargar datos de la hoja Portafolio
    const portfolioData = await fetchSheetData(DASHBOARD_CONFIG.SHEETS.PORTAFOLIO);
    console.log('✅ Datos de Portafolio cargados:', portfolioData.length, 'filas');
    
    // Cargar historial de precios
    await loadHistPrecios();
    
    // Procesar datos del portafolio
    processPortafolio(portfolioData);
    
    // Actualizar timestamp
    state.lastUpdate = new Date();
    updateStatus('En línea');
    
    // Renderizar todo
    renderAll();
    
    console.log('✅ Dashboard actualizado correctamente');
    
  } catch (error) {
    console.error('❌ Error cargando datos:', error);
    updateStatus('Error');
    showError('Error al cargar datos del Google Sheet');
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
  
  // Validar que la hoja tenga datos
  if (!json.table || !json.table.rows || json.table.rows.length === 0) {
    throw new Error(`La hoja "${sheetName}" está vacía o no existe`);
  }
  
  return json.table.rows;
}

async function loadHistPrecios() {
  try {
    console.log('📊 Cargando historial de precios...');
    const rows = await fetchSheetData(DASHBOARD_CONFIG.SHEETS.PRECIOS);
    
    const histData = {};
    
    rows.forEach(row => {
      const fecha = row.c[0]?.f || row.c[0]?.v; // Fecha
      const activo = row.c[1]?.v; // Activo
      const precio = parseFloat(row.c[2]?.v || 0); // Precio
      
      if (activo && precio > 0) {
        if (!histData[activo]) {
          histData[activo] = [];
        }
        histData[activo].push({ fecha, precio });
      }
    });
    
    state.preciosHistoricos = histData;
    console.log('✅ Historial de precios cargado:', Object.keys(histData).length, 'activos');
    
  } catch (error) {
    console.warn('⚠️ No se pudo cargar historial de precios:', error.message);
    state.preciosHistoricos = {};
  }
}

// ============================================
// PROCESAMIENTO DE DATOS
// ============================================

function processPortafolio(rows) {
  console.log('🔄 Procesando datos del portafolio...');
  
  const activosMap = new Map();
  const transacciones = [];
  
  rows.forEach((row, index) => {
    const cells = row.c;
    
    // Extraer datos de la fila
    const fecha = cells[0]?.f || cells[0]?.v || '';
    const activo = cells[1]?.v || '';
    const tipo = cells[2]?.v || '';
    const cantidad = parseFloat(cells[3]?.v || 0);
    const precioCompra = parseFloat(cells[4]?.v || 0);
    const inversionUsdt = parseFloat(cells[5]?.v || 0);
    const precioActual = parseFloat(cells[6]?.v || 0);
    const valorActual = parseFloat(cells[7]?.v || 0);
    const pl = parseFloat(cells[8]?.v || 0);
    const exchange = cells[9]?.v || '';
    
    // Validar que sea una transacción válida
    if (!activo || activo === 'Activo' || inversionUsdt === 0) {
      return; // Skip encabezados y filas vacías
    }
    
    // Agregar a transacciones
    transacciones.push({
      fecha,
      activo,
      tipo,
      cantidad,
      precioCompra,
      inversionUsdt,
      precioActual,
      valorActual,
      pl,
      exchange
    });
    
    // Agregar o actualizar en el mapa de activos
    if (!activosMap.has(activo)) {
      activosMap.set(activo, {
        symbol: activo,
        name: getActivoName(activo),
        cantidad: 0,
        inversionUsdt: 0,
        valorActual: 0,
        pl: 0,
        roi: 0,
        precioActual: precioActual,
        precioPromedio: 0,
        exchanges: new Set()
      });
    }
    
    const activoData = activosMap.get(activo);
    activoData.cantidad += cantidad;
    activoData.inversionUsdt += inversionUsdt;
    activoData.valorActual += valorActual;
    activoData.pl += pl;
    activoData.precioActual = precioActual; // Último precio
    if (exchange) activoData.exchanges.add(exchange);
  });
  
  // Convertir mapa a array y calcular ROI
  const activos = Array.from(activosMap.values()).map(activo => {
    if (activo.inversionUsdt > 0) {
      activo.roi = (activo.pl / activo.inversionUsdt) * 100;
      activo.roi = Math.max(-100, Math.min(10000, activo.roi)); // Limitar ROI
    }
    activo.precioPromedio = activo.cantidad > 0 ? activo.inversionUsdt / activo.cantidad : 0;
    activo.exchanges = Array.from(activo.exchanges);
    return activo;
  });
  
  // Ordenar por valor actual (mayor a menor)
  activos.sort((a, b) => b.valorActual - a.valorActual);
  
  // Calcular KPIs
  const kpis = {
    totalInvertido: activos.reduce((sum, a) => sum + a.inversionUsdt, 0),
    valorActual: activos.reduce((sum, a) => sum + a.valorActual, 0),
    plTotal: activos.reduce((sum, a) => sum + a.pl, 0),
    roiTotal: 0,
    numActivos: activos.length,
    numTransacciones: transacciones.length,
    numExchanges: new Set(transacciones.map(t => t.exchange).filter(e => e)).size
  };
  
  if (kpis.totalInvertido > 0) {
    kpis.roiTotal = (kpis.plTotal / kpis.totalInvertido) * 100;
  }
  
  // Actualizar estado
  state.activos = activos;
  state.transacciones = transacciones;
  state.kpis = kpis;
  
  console.log('✅ Portafolio procesado:', activos.length, 'activos,', transacciones.length, 'transacciones');
  console.log('📊 KPIs:', kpis);
}

function getActivoName(symbol) {
  const names = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'SOL': 'Solana',
    'LINK': 'Chainlink',
    'AVAX': 'Avalanche',
    'DOGE': 'Dogecoin',
    'ADA': 'Cardano',
    'DOT': 'Polkadot',
    'MATIC': 'Polygon'
  };
  return names[symbol] || symbol;
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
  
  // Total Invertido
  const totalInvertidoEl = document.querySelector('.kpi-card:nth-child(1) .kpi-value');
  if (totalInvertidoEl) totalInvertidoEl.textContent = `$${totalInvertido.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  // Valor Actual
  const valorActualEl = document.querySelector('.kpi-card:nth-child(2) .kpi-value');
  if (valorActualEl) valorActualEl.textContent = `$${valorActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  // P&L Total
  const plTotalEl = document.querySelector('.kpi-card:nth-child(3) .kpi-value');
  const plPercentEl = document.querySelector('.kpi-card:nth-child(3) .kpi-change');
  if (plTotalEl) {
    plTotalEl.textContent = `$${plTotal >= 0 ? '' : ''}${plTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    plTotalEl.style.color = plTotal >= 0 ? 'var(--success)' : 'var(--danger)';
  }
  if (plPercentEl) {
    plPercentEl.textContent = `${roiTotal >= 0 ? '+' : ''}${roiTotal.toFixed(2)}%`;
    plPercentEl.style.color = roiTotal >= 0 ? 'var(--success)' : 'var(--danger)';
  }
  
  // Activos
  const activosEl = document.querySelector('.kpi-card:nth-child(4) .kpi-value');
  if (activosEl) activosEl.textContent = numActivos;
  
  // Transacciones
  const transaccionesEl = document.querySelector('.kpi-card:nth-child(5) .kpi-value');
  if (transaccionesEl) transaccionesEl.textContent = numTransacciones;
  
  // Exchanges
  const exchangesEl = document.querySelector('.kpi-card:nth-child(6) .kpi-value');
  if (exchangesEl) exchangesEl.textContent = numExchanges;
  
  console.log('✅ KPIs renderizados');
}

function renderGoalChart() {
  const canvas = document.getElementById('goalChart');
  if (!canvas) return;
  
  const objetivo = 5000;
  const inversionActual = state.kpis.totalInvertido;
  const falta = Math.max(0, objetivo - inversionActual);
  const excedente = Math.max(0, inversionActual - objetivo);
  const progreso = Math.min(100, (inversionActual / objetivo) * 100);
  
  // Actualizar textos
  document.querySelector('.goal-stat:nth-child(1) .goal-value').textContent = `$${inversionActual.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  document.querySelector('.goal-stat:nth-child(2) .goal-value').textContent = `$${objetivo.toLocaleString('en-US')}`;
  
  if (excedente > 0) {
    document.querySelector('.goal-stat:nth-child(3) .goal-label').textContent = 'Excedente';
    document.querySelector('.goal-stat:nth-child(3) .goal-value').textContent = `$${excedente.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    document.querySelector('.goal-stat:nth-child(3) .goal-value').style.color = 'var(--success)';
  } else {
    document.querySelector('.goal-stat:nth-child(3) .goal-label').textContent = 'Falta';
    document.querySelector('.goal-stat:nth-child(3) .goal-value').textContent = `$${falta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    document.querySelector('.goal-stat:nth-child(3) .goal-value').style.color = 'var(--danger)';
  }
  
  document.querySelector('.goal-stat:nth-child(4) .goal-value').textContent = `${progreso.toFixed(1)}%`;
  
  // Renderizar gráfico
  if (state.charts.goalChart) {
    state.charts.goalChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  state.charts.goalChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Objetivo de Inversión'],
      datasets: [
        {
          label: 'Invertido',
          data: [Math.min(inversionActual, objetivo)],
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 2
        },
        {
          label: excedente > 0 ? 'Excedente' : 'Falta',
          data: [excedente > 0 ? excedente : falta],
          backgroundColor: excedente > 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(239, 68, 68, 0.3)',
          borderColor: excedente > 0 ? 'rgb(59, 130, 246)' : 'rgb(239, 68, 68)',
          borderWidth: 2,
          borderDash: excedente > 0 ? [] : [5, 5]
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#ffffff', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: $${context.parsed.x.toLocaleString('en-US')}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: '#ffffff', callback: (value) => `$${value.toLocaleString('en-US')}` }
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#ffffff' }
        }
      }
    }
  });
  
  console.log('✅ Gráfico de objetivo renderizado');
}

function renderCharts() {
  renderPriceChart();
  renderPortfolioCurveChart();
  renderPLChart();
  renderDrawdownChart();
  renderPortfolioChart();
  renderBubbleChart();
}

function renderPriceChart() {
  const canvas = document.getElementById('priceChart');
  if (!canvas) return;
  
  const days = getPeriodDays();
  const labels = generateDateLabels(days);
  
  // Obtener top 5 activos por valor
  const topActivos = state.activos.slice(0, 5);
  
  const datasets = topActivos.map(activo => {
    const data = buildPriceChartData(activo.symbol, days);
    return {
      label: activo.name,
      data: data,
      borderColor: getActivoColor(activo.symbol),
      backgroundColor: getActivoColor(activo.symbol, 0.1),
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4
    };
  });
  
  if (state.charts.priceChart) {
    state.charts.priceChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  state.charts.priceChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#ffffff', font: { size: 11 }, padding: 10 }
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: 'rgba(255,255,255,0.75)', maxRotation: 0 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: 'rgba(255,255,255,0.75)',
            callback: (value) => `$${value.toLocaleString('en-US')}`
          }
        }
      }
    }
  });
  
  console.log('✅ Gráfico de precios renderizado');
}

function buildPriceChartData(activo, days) {
  // Si tenemos datos históricos reales, usarlos
  if (state.preciosHistoricos[activo] && state.preciosHistoricos[activo].length > 0) {
    const histData = state.preciosHistoricos[activo].slice(-days);
    return histData.map(d => d.precio);
  }
  
  // Fallback: generar datos aproximados basados en precio actual
  const activoData = state.activos.find(a => a.symbol === activo);
  if (!activoData || !activoData.precioActual) {
    return Array(days).fill(0);
  }
  
  const precioActual = activoData.precioActual;
  const roi = activoData.roi || 0;
  const precioInicial = precioActual / (1 + roi / 100);
  
  // Generar progresión lineal desde precio inicial hasta actual
  const data = [];
  for (let i = 0; i < days; i++) {
    const progress = i / (days - 1);
    const precio = precioInicial + (precioActual - precioInicial) * progress;
    data.push(precio);
  }
  
  return data;
}

function renderPortfolioCurveChart() {
  const canvas = document.getElementById('portfolioCurveChart');
  if (!canvas) return;
  
  const days = getPeriodDays();
  const labels = generateDateLabels(days);
  
  const invertidoData = buildPortfolioCurveData(state.kpis.totalInvertido, days, 'invested');
  const valorData = buildPortfolioCurveData(state.kpis.valorActual, days, 'value');
  
  if (state.charts.portfolioCurveChart) {
    state.charts.portfolioCurveChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  state.charts.portfolioCurveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Invertido',
          data: invertidoData,
          borderColor: 'rgb(251, 191, 36)',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        },
        {
          label: 'Valor',
          data: valorData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#ffffff', font: { size: 11 } }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: 'rgba(255,255,255,0.75)' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: 'rgba(255,255,255,0.75)',
            callback: (value) => `$${value.toLocaleString('en-US')}`
          }
        }
      }
    }
  });
  
  console.log('✅ Gráfico de curva del portafolio renderizado');
}

function buildPortfolioCurveData(finalValue, days, type) {
  // Aproximación: progresión lineal desde valor inicial hasta final
  const startValue = type === 'invested' ? finalValue * 0.9 : finalValue * 0.85;
  const data = [];
  
  for (let i = 0; i < days; i++) {
    const progress = i / (days - 1);
    const value = startValue + (finalValue - startValue) * progress;
    data.push(value);
  }
  
  return data;
}

function renderPLChart() {
  const canvas = document.getElementById('plChart');
  if (!canvas) return;
  
  const topActivos = state.activos.slice(0, 6);
  const labels = topActivos.map(a => a.symbol);
  const data = topActivos.map(a => a.pl);
  const colors = data.map(pl => pl >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)');
  
  if (state.charts.plChart) {
    state.charts.plChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  state.charts.plChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'P&L (USDT)',
        data,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.8', '1')),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `P&L: $${context.parsed.y.toFixed(2)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#ffffff' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: 'rgba(255,255,255,0.75)',
            callback: (value) => `$${value.toLocaleString('en-US')}`
          }
        }
      }
    }
  });
  
  console.log('✅ Gráfico de P&L renderizado');
}

function renderDrawdownChart() {
  const canvas = document.getElementById('drawdownChart');
  if (!canvas) return;
  
  const days = getPeriodDays();
  const labels = generateDateLabels(days);
  const data = buildDrawdownData(days);
  
  if (state.charts.drawdownChart) {
    state.charts.drawdownChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  state.charts.drawdownChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Drawdown (%)',
        data,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderWidth: 2,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: 'rgba(255,255,255,0.75)' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { 
            color: 'rgba(255,255,255,0.75)',
            callback: (value) => `${value.toFixed(1)}%`
          }
        }
      }
    }
  });
  
  console.log('✅ Gráfico de drawdown renderizado');
}

function buildDrawdownData(days) {
  // Calcular drawdown basado en ROI actual
  const roiPercent = state.kpis.roiTotal;
  const data = [];
  
  for (let i = 0; i < days; i++) {
    const progress = i / (days - 1);
    // Simular drawdown que va desde 0 hasta el ROI actual (negativo si hay pérdida)
    const drawdown = roiPercent * progress;
    data.push(drawdown);
  }
  
  return data;
}

function renderPortfolioChart() {
  const canvas = document.getElementById('portfolioChart');
  if (!canvas) return;
  
  const labels = state.activos.map(a => a.name);
  const data = state.activos.map(a => a.valorActual);
  const colors = state.activos.map(a => getActivoColor(a.symbol));
  
  if (state.charts.portfolioChart) {
    state.charts.portfolioChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  state.charts.portfolioChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.8', '1')),
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
          labels: { color: '#ffffff', font: { size: 11 }, padding: 8 }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percent = ((value / total) * 100).toFixed(1);
              return `${context.label}: $${value.toFixed(2)} (${percent}%)`;
            }
          }
        }
      }
    }
  });
  
  console.log('✅ Gráfico de composición renderizado');
}

function renderBubbleChart() {
  const canvas = document.getElementById('bubbleChart');
  if (!canvas) return;
  
  const totalValor = state.kpis.valorActual;
  
  const data = state.activos.map(activo => {
    const percentPortfolio = (activo.valorActual / totalValor) * 100;
    return {
      x: percentPortfolio,
      y: activo.roi,
      r: Math.sqrt(activo.valorActual) / 5, // Radio proporcional al valor
      label: activo.symbol,
      valor: activo.valorActual
    };
  });
  
  if (state.charts.bubbleChart) {
    state.charts.bubbleChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  state.charts.bubbleChart = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: [{
        label: 'Activos',
        data,
        backgroundColor: state.activos.map(a => getActivoColor(a.symbol, 0.6)),
        borderColor: state.activos.map(a => getActivoColor(a.symbol)),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = context.raw;
              return [
                `${point.label}`,
                `% Portafolio: ${point.x.toFixed(1)}%`,
                `ROI: ${point.y.toFixed(2)}%`,
                `Valor: $${point.valor.toFixed(2)}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: '% del Portafolio', color: '#ffffff' },
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: 'rgba(255,255,255,0.75)', callback: (value) => `${value}%` }
        },
        y: {
          title: { display: true, text: 'ROI (%)', color: '#ffffff' },
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: 'rgba(255,255,255,0.75)', callback: (value) => `${value}%` }
        }
      }
    }
  });
  
  console.log('✅ Gráfico de mapa de cartera renderizado');
}

function renderWatchlist() {
  const watchlistContent = document.getElementById('watchlistContent');
  if (!watchlistContent) return;
  
  const html = state.activos.map(activo => {
    const percentPortfolio = (activo.valorActual / state.kpis.valorActual) * 100;
    const roiClass = activo.roi >= 0 ? 'success' : 'danger';
    const roiSign = activo.roi >= 0 ? '+' : '';
    
    return `
      <div class="watchlist-item" style="animation-delay: ${state.activos.indexOf(activo) * 0.05}s">
        <div class="watchlist-icon" style="background: ${getActivoColor(activo.symbol)}">
          ${activo.symbol.substring(0, 1)}
        </div>
        <div class="watchlist-info">
          <div class="watchlist-name">${activo.name}</div>
          <div class="watchlist-details">
            <span class="watchlist-percent">${percentPortfolio.toFixed(1)}%</span>
            <span class="watchlist-roi ${roiClass}">${roiSign}${activo.roi.toFixed(2)}%</span>
          </div>
          <div class="watchlist-values">
            <span>Inv: $${activo.inversionUsdt.toFixed(0)}</span>
            <span>Val: $${activo.valorActual.toFixed(0)}</span>
            <span>P&L: ${roiSign}$${activo.pl.toFixed(0)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  watchlistContent.innerHTML = html;
  console.log('✅ Watchlist renderizada');
}

function renderTable() {
  const tbody = document.querySelector('#professionalTable tbody');
  if (!tbody) {
    console.warn('⚠️ Tabla no encontrada');
    return;
  }
  
  if (state.activos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:rgba(255,255,255,0.5);">No hay datos disponibles</td></tr>';
    return;
  }
  
  try {
    const html = state.activos.map(activo => {
      const roiClass = activo.roi >= 0 ? 'success' : 'danger';
      const roiSign = activo.roi >= 0 ? '+' : '';
      const percentPortfolio = (activo.valorActual / state.kpis.valorActual) * 100;
      
      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <div style="width:8px;height:8px;border-radius:50%;background:${getActivoColor(activo.symbol)}"></div>
              <div>
                <div style="font-weight:600;">${activo.name}</div>
                <div style="font-size:0.75rem;color:rgba(255,255,255,0.5);">${percentPortfolio.toFixed(1)}%</div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight:500;">USDT ${activo.inversionUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </td>
          <td>
            <div style="font-weight:500;">USDT ${activo.valorActual.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </td>
          <td>
            <div style="color:${activo.pl >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:500;">
              ${roiSign}USDT ${Math.abs(activo.pl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </td>
          <td>
            <div class="${roiClass}" style="font-weight:600;">
              ${roiSign}${activo.roi.toFixed(2)}%
            </div>
          </td>
          <td>
            <div style="font-weight:500;">USD ${activo.precioActual.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </td>
        </tr>
      `;
    }).join('');
    
    tbody.innerHTML = html;
    console.log('✅ Tabla renderizada con', state.activos.length, 'activos');
    
  } catch (error) {
    console.error('❌ Error renderizando tabla:', error);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--danger);">Error al cargar datos</td></tr>';
  }
}

// ============================================
// UTILIDADES
// ============================================

function getPeriodDays() {
  switch (state.currentPeriod) {
    case '7d': return 7;
    case '30d': return 30;
    default: return 90; // 'all'
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

function getActivoColor(symbol, alpha = 0.8) {
  const colors = {
    'BTC': `rgba(251, 191, 36, ${alpha})`,      // Amber
    'ETH': `rgba(99, 102, 241, ${alpha})`,      // Indigo
    'SOL': `rgba(16, 185, 129, ${alpha})`,      // Emerald
    'LINK': `rgba(59, 130, 246, ${alpha})`,     // Blue
    'AVAX': `rgba(239, 68, 68, ${alpha})`,      // Red
    'DOGE': `rgba(236, 72, 153, ${alpha})`,     // Pink
    'ADA': `rgba(139, 92, 246, ${alpha})`,      // Violet
    'DOT': `rgba(236, 72, 153, ${alpha})`,      // Pink
    'MATIC': `rgba(168, 85, 247, ${alpha})`     // Purple
  };
  return colors[symbol] || `rgba(156, 163, 175, ${alpha})`;
}

function updateStatus(status) {
  const statusEl = document.querySelector('.status-badge');
  if (statusEl) {
    statusEl.textContent = status;
    statusEl.className = 'status-badge';
    if (status === 'En línea') {
      statusEl.classList.add('status-online');
    } else if (status === 'Error') {
      statusEl.classList.add('status-error');
    }
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Botón de actualización
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      console.log('🔄 Actualización manual solicitada');
      refreshBtn.disabled = true;
      refreshBtn.textContent = '⏳ Actualizando...';
      
      try {
        await loadData();
        refreshBtn.textContent = '✓ Actualizado';
        setTimeout(() => {
          refreshBtn.disabled = false;
          refreshBtn.textContent = '↻ Actualizar';
        }, 2000);
      } catch (error) {
        refreshBtn.textContent = '✗ Error';
        setTimeout(() => {
          refreshBtn.disabled = false;
          refreshBtn.textContent = '↻ Actualizar';
        }, 2000);
      }
    });
  }
  
  // Botón de tema
  const themeToggle = document.querySelector('[aria-label="Cambiar tema claro/oscuro"]');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Botones de período
  const periodButtons = document.querySelectorAll('[aria-label^="Ver"]');
  periodButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const text = e.target.textContent.trim();
      if (text === 'Todo') state.currentPeriod = 'all';
      else if (text === '30D') state.currentPeriod = '30d';
      else if (text === '7D') state.currentPeriod = '7d';
      
      // Actualizar botones activos
      periodButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // Re-renderizar gráficos
      renderCharts();
      console.log('📊 Período cambiado a:', state.currentPeriod);
    });
  });
  
  // Botón de watchlist
  const watchlistToggle = document.querySelector('[aria-label="Abrir watchlist de activos"]');
  if (watchlistToggle) {
    watchlistToggle.addEventListener('click', () => {
      const content = document.getElementById('watchlistContent');
      if (content) {
        content.classList.toggle('open');
        watchlistToggle.textContent = content.classList.contains('open') ? '🔽 Cerrar' : '🔄 Tap para abrir';
      }
    });
  }
  
  console.log('✅ Event listeners configurados');
}

// ============================================
// TEMA
// ============================================

function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  const themeToggle = document.querySelector('[aria-label="Cambiar tema claro/oscuro"]');
  if (themeToggle) {
    themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  }
  
  console.log('🎨 Tema cambiado a:', newTheme);
}
