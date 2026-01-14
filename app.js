// ============================================
// HEIDI CRYPTO PORTFOLIO - APP.JS v4.1
// Dashboard Premium - Solo hoja Portafolio
// FIX: Selectores correctos para KPIs
// ============================================

console.log('%c🚀 HEIDI Dashboard v4.1 - Iniciando...', 'color: #00d4ff; font-size: 16px; font-weight: bold;');

// ============================================
// ESTADO GLOBAL UNIFICADO
// ============================================

const state = {
  activos: [],
  transacciones: [],
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
  const loading = document.getElementById('loadingScreen');
  if (loading) {
    loading.style.opacity = '0';
    setTimeout(() => loading.style.display = 'none', 300);
  }
}

function showError(message) {
  console.error('Error:', message);
  // Mostrar mensaje de error en el dashboard
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(255,107,157,0.9);color:white;padding:1rem 2rem;border-radius:8px;z-index:10000;';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

// ============================================
// CARGA DE DATOS
// ============================================

async function loadData() {
  console.log('📊 Cargando datos del Google Sheet...');
  updateStatus('Sincronizando...');
  
  try {
    // Cargar datos de Portafolio
    const portafolioData = await fetchSheetData(DASHBOARD_CONFIG.SHEETS.PORTAFOLIO);
    console.log('✅ Datos de Portafolio cargados:', portafolioData.length, 'filas');
    
    // Procesar datos
    processPortafolio(portafolioData);
    
    // Actualizar timestamp
    state.lastUpdate = new Date();
    updateStatus('En línea');
    
    // Renderizar todo
    renderAll();
    
    console.log('✅ Dashboard actualizado correctamente');
    console.log('📊 KPIs:', state.kpis);
    console.log('📊 Activos:', state.activos);
    
  } catch (error) {
    console.error('❌ Error al cargar datos:', error);
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

function processPortafolio(rows) {
  console.log('🔄 Procesando Portafolio...');
  console.log('📊 Total de filas recibidas:', rows.length);
  
  // Estructura de columnas:
  // A: Fecha
  // B: Activo
  // C: Inversión USDT
  // D: Tipo
  // E: Orden
  // F: Exchange
  // G: Cantidad/Moneda Crypto
  // H: Precio Compra
  
  const transacciones = [];
  const activosMap = new Map();
  
  // Procesar todas las filas (saltar encabezado si existe)
  let startIndex = 0;
  
  // Detectar encabezado (primera fila con "Fecha" o "Activo")
  const primeraFila = rows[0].c;
  const primerValor = (primeraFila[0]?.v || '').toString().toLowerCase();
  if (primerValor.includes('fecha') || primerValor.includes('date')) {
    startIndex = 1;
    console.log('✅ Encabezado detectado, saltando fila 0');
  }
  
  for (let i = startIndex; i < rows.length; i++) {
    const cells = rows[i].c;
    
    // Extraer datos de las columnas
    const fecha = cells[0]?.v || cells[0]?.f || '';
    const activo = (cells[1]?.v || '').toString().trim().toUpperCase();
    const inversionUsdt = parseFloat(cells[2]?.v || 0);
    const tipo = cells[3]?.v || '';
    const orden = cells[4]?.v || '';
    const exchange = cells[5]?.v || '';
    const cantidad = parseFloat(cells[6]?.v || 0);
    const precioCompra = parseFloat(cells[7]?.v || 0);
    
    // Validar que sea una fila válida
    if (!activo || inversionUsdt === 0 || cantidad === 0) {
      continue;
    }
    
    // Validar que sea un activo conocido
    if (!['BTC', 'ETH', 'SOL', 'LINK', 'AVAX', 'DOGE'].includes(activo)) {
      continue;
    }
    
    // Crear objeto de transacción
    const transaccion = {
      fecha,
      activo,
      inversionUsdt,
      tipo,
      orden,
      exchange,
      cantidad,
      precioCompra
    };
    
    transacciones.push(transaccion);
    
    // Agrupar por activo
    if (!activosMap.has(activo)) {
      activosMap.set(activo, {
        symbol: activo,
        name: DASHBOARD_CONFIG.NOMBRES[activo] || activo,
        transacciones: [],
        cantidadTotal: 0,
        inversionTotal: 0,
        costoProm: 0
      });
    }
    
    const activoData = activosMap.get(activo);
    activoData.transacciones.push(transaccion);
    activoData.cantidadTotal += cantidad;
    activoData.inversionTotal += inversionUsdt;
  }
  
  console.log(`✅ Procesadas ${transacciones.length} transacciones`);
  console.log(`✅ Encontrados ${activosMap.size} activos diferentes`);
  
  // Calcular métricas por activo
  const activos = [];
  let totalInvertido = 0;
  let valorActual = 0;
  let plTotal = 0;
  
  for (const [symbol, data] of activosMap) {
    // Calcular costo promedio
    data.costoProm = data.inversionTotal / data.cantidadTotal;
    
    // TODO: Obtener precio actual de las APIs
    // Por ahora, usar el precio de compra promedio como placeholder
    data.precioActual = data.costoProm * 1.05; // Simular 5% de ganancia
    
    // Calcular valor actual
    data.valorActual = data.cantidadTotal * data.precioActual;
    
    // Calcular P&L
    data.pl = data.valorActual - data.inversionTotal;
    
    // Calcular ROI
    data.roi = (data.pl / data.inversionTotal) * 100;
    data.roi = Math.max(-100, Math.min(10000, data.roi)); // Limitar ROI
    
    // Calcular variación 24h (placeholder)
    data.var24h = 0;
    
    activos.push(data);
    
    // Sumar a totales
    totalInvertido += data.inversionTotal;
    valorActual += data.valorActual;
    plTotal += data.pl;
    
    console.log(`✅ ${symbol}: Inversión=${data.inversionTotal.toFixed(2)}, Valor=${data.valorActual.toFixed(2)}, P/L=${data.pl.toFixed(2)}, ROI=${data.roi.toFixed(2)}%`);
  }
  
  // Calcular ROI total
  let roiTotal = 0;
  if (totalInvertido > 0) {
    roiTotal = (plTotal / totalInvertido) * 100;
  }
  
  // Actualizar estado
  state.transacciones = transacciones;
  state.activos = activos;
  state.kpis = {
    totalInvertido: totalInvertido,
    valorActual: valorActual,
    plTotal: plTotal,
    roiTotal: roiTotal,
    numActivos: activos.length,
    numTransacciones: transacciones.length,
    numExchanges: 1 // Binance
  };
  
  console.log('✅ Estado actualizado:', state.kpis);
}

// ============================================
// RENDERIZADO
// ============================================

function renderAll() {
  console.log('🎨 Renderizando dashboard...');
  
  try {
    updateKPIs();
    renderCharts();
    renderWatchlist();
    renderTable();
    
    console.log('✅ Dashboard renderizado correctamente');
  } catch (error) {
    console.error('❌ Error al renderizar:', error);
  }
}

function updateKPIs() {
  const kpis = state.kpis;
  
  console.log('📊 Actualizando KPIs:', kpis);
  
  // Total Invertido
  const totalInvertidoEl = document.getElementById('kpiInvertido');
  if (totalInvertidoEl) {
    totalInvertidoEl.textContent = `$${kpis.totalInvertido.toFixed(2)}`;
    console.log('✅ Total Invertido actualizado:', totalInvertidoEl.textContent);
  } else {
    console.error('❌ Elemento kpiInvertido no encontrado');
  }
  
  // Valor Actual
  const valorActualEl = document.getElementById('kpiActual');
  if (valorActualEl) {
    valorActualEl.textContent = `$${kpis.valorActual.toFixed(2)}`;
    console.log('✅ Valor Actual actualizado:', valorActualEl.textContent);
  } else {
    console.error('❌ Elemento kpiActual no encontrado');
  }
  
  // P&L Total
  const plTotalEl = document.getElementById('kpiPL');
  if (plTotalEl) {
    const signo = kpis.plTotal >= 0 ? '+' : '';
    plTotalEl.textContent = `${signo}$${kpis.plTotal.toFixed(2)}`;
    plTotalEl.style.color = kpis.plTotal >= 0 ? '#00ff88' : '#ff6b9d';
    console.log('✅ P&L Total actualizado:', plTotalEl.textContent);
  } else {
    console.error('❌ Elemento kpiPL no encontrado');
  }
  
  // ROI Percent
  const roiPercentEl = document.getElementById('kpiPLPercent');
  if (roiPercentEl) {
    const signo = kpis.roiTotal >= 0 ? '+' : '';
    roiPercentEl.textContent = `${signo}${kpis.roiTotal.toFixed(2)}%`;
    roiPercentEl.style.color = kpis.roiTotal >= 0 ? '#00ff88' : '#ff6b9d';
    console.log('✅ ROI Percent actualizado:', roiPercentEl.textContent);
  } else {
    console.error('❌ Elemento kpiPLPercent no encontrado');
  }
  
  // Activos
  const activosEl = document.getElementById('kpiActivos');
  if (activosEl) {
    activosEl.textContent = kpis.numActivos;
    console.log('✅ Activos actualizado:', activosEl.textContent);
  } else {
    console.error('❌ Elemento kpiActivos no encontrado');
  }
  
  // Transacciones
  const transaccionesEl = document.getElementById('kpiTransacciones');
  if (transaccionesEl) {
    transaccionesEl.textContent = kpis.numTransacciones;
    console.log('✅ Transacciones actualizado:', transaccionesEl.textContent);
  } else {
    console.error('❌ Elemento kpiTransacciones no encontrado');
  }
  
  // Exchanges
  const exchangesEl = document.getElementById('kpiExchanges');
  if (exchangesEl) {
    exchangesEl.textContent = kpis.numExchanges;
    console.log('✅ Exchanges actualizado:', exchangesEl.textContent);
  } else {
    console.error('❌ Elemento kpiExchanges no encontrado');
  }
  
  // Actualizar gráfico de objetivo
  updateGoalChart();
  
  console.log('✅ KPIs actualizados');
}

function updateGoalChart() {
  const objetivo = 5000;
  const actual = state.kpis.totalInvertido;
  const falta = Math.max(0, objetivo - actual);
  const progreso = Math.min(100, (actual / objetivo) * 100);
  
  console.log(`🎯 Actualizando gráfico de objetivo: Actual=${actual}, Falta=${falta}, Progreso=${progreso}%`);
  
  // Actualizar valores con verificación de existencia
  const actualEl = document.getElementById('goalActual');
  if (actualEl) {
    actualEl.textContent = `$${actual.toFixed(2)}`;
    console.log('✅ goalActual actualizado');
  } else {
    console.warn('⚠️ Elemento goalActual no encontrado');
  }
  
  const faltaEl = document.getElementById('goalFalta');
  if (faltaEl) {
    faltaEl.textContent = `$${falta.toFixed(2)}`;
    console.log('✅ goalFalta actualizado');
  } else {
    console.warn('⚠️ Elemento goalFalta no encontrado');
  }
  
  const progresoEl = document.getElementById('goalProgreso');
  if (progresoEl) {
    progresoEl.textContent = `${progreso.toFixed(1)}%`;
    console.log('✅ goalProgreso actualizado');
  } else {
    console.warn('⚠️ Elemento goalProgreso no encontrado');
  }
  
  // Actualizar porcentaje central del gauge
  const progressCenterEl = document.getElementById('goalProgressCenter');
  if (progressCenterEl) {
    progressCenterEl.textContent = `${progreso.toFixed(1)}%`;
    console.log('✅ goalProgressCenter actualizado');
  } else {
    console.warn('⚠️ Elemento goalProgressCenter no encontrado');
  }
  
  // Actualizar gráfico gauge
  renderGoalGauge(progreso);
}

function renderGoalGauge(progreso) {
  const canvas = document.getElementById('goalChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Destruir gráfico anterior si existe
  if (state.charts.goal) {
    state.charts.goal.destroy();
  }
  
  // Crear gráfico de gauge (doughnut con 50% vacío)
  state.charts.goal = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [progreso, 100 - progreso],
        backgroundColor: [
          progreso >= 100 ? '#00ff88' : progreso >= 50 ? '#00d4ff' : '#ff6b9d',
          'rgba(255, 255, 255, 0.1)'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '75%',
      rotation: -90,
      circumference: 180,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      }
    }
  });
}

function renderCharts() {
  // TODO: Implementar gráficos avanzados
  console.log('📊 Renderizando gráficos...');
}

function renderWatchlist() {
  // TODO: Implementar watchlist
  console.log('📋 Renderizando watchlist...');
}

function renderTable() {
  const tbody = document.querySelector('#professionalTable tbody');
  if (!tbody) {
    console.warn('⚠️ Tabla no encontrada');
    return;
  }
  
  tbody.innerHTML = '';
  
  state.activos.forEach(activo => {
    const tr = document.createElement('tr');
    
    const color = DASHBOARD_CONFIG.COLORS[activo.symbol] || '#ffffff';
    const icon = DASHBOARD_CONFIG.ICONS[activo.symbol] || activo.symbol;
    
    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span style="color:${color};font-size:1.2rem;">${icon}</span>
          <div>
            <div style="font-weight:600;">${activo.name}</div>
            <div style="font-size:0.75rem;opacity:0.7;">${(activo.cantidadTotal * 100).toFixed(2)}%</div>
          </div>
        </div>
      </td>
      <td>USDT<br/>${activo.inversionTotal.toFixed(2)}</td>
      <td>USDT<br/>${activo.valorActual.toFixed(2)}</td>
      <td style="color:${activo.pl >= 0 ? '#00ff88' : '#ff6b9d'}">
        USDT<br/>${activo.pl >= 0 ? '+' : ''}${activo.pl.toFixed(2)}
      </td>
      <td style="color:${activo.roi >= 0 ? '#00ff88' : '#ff6b9d'}">
        ${activo.roi >= 0 ? '+' : ''}${activo.roi.toFixed(2)}%
      </td>
      <td>USD<br/>${activo.precioActual.toFixed(2)}</td>
    `;
    
    tbody.appendChild(tr);
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
    refreshBtn.addEventListener('click', () => {
      console.log('🔄 Actualizando manualmente...');
      loadData();
    });
  }
  
  // Botón de tema
  const themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }
  
  // Botones de período
  document.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentPeriod = btn.dataset.period;
      renderCharts();
    });
  });
  
  console.log('✅ Event listeners configurados');
}

// ============================================
// TEMA
// ============================================

function loadTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// ============================================
// UTILIDADES
// ============================================

function updateStatus(status) {
  const statusEl = document.getElementById('statusText');
  if (statusEl) {
    statusEl.textContent = status;
  }
  
  const statusDot = document.getElementById('statusDot');
  if (statusDot) {
    statusDot.className = status === 'En línea' ? 'status-dot online' : 'status-dot';
  }
  
  // Actualizar última actualización
  if (state.lastUpdate) {
    const timeEl = document.getElementById('lastUpdateTime');
    if (timeEl) {
      const now = new Date();
      const diff = Math.floor((now - state.lastUpdate) / 1000 / 60);
      timeEl.textContent = `hace ${diff} minuto${diff !== 1 ? 's' : ''}`;
    }
  }
}

console.log('✅ App.js v4.1 cargado correctamente');
