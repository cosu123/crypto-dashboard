// Configuración del Dashboard Premium
const DASHBOARD_CONFIG = {
  // ID del Google Sheet
  SHEET_ID: '1Bx0NizfyQjrLVkuHRLcWBK1_ZOFSRtF9vOql4IV5Ap4',
  
  // Nombres de las hojas
  SHEETS: {
    PORTAFOLIO: 'Portafolio',
    PRECIOS: '_Hist_Precios',
    RESUMEN: 'Resumen_Activo'
  },
  
  // Mapeo de filas de resumen por activo
  // Las filas de resumen tienen la columna "Activos" con valor "Total {ACTIVO}/Usdt"
  // NOTA: DOGE omitido por solicitud del usuario
  ACTIVOS_MAPPING: {
    'Total BTC/Usdt': 'BTC',
    'Total ETH/Usdt': 'ETH',
    'Total SOL/Usdt': 'SOL',
    'Total LINK/Usdt': 'LINK',
    'Total AVAX/Usdt': 'AVAX'
  },
  
  // Colores por activo
  COLORS: {
    BTC: '#f7931a',
    ETH: '#627eea',
    SOL: '#14f195',
    LINK: '#2a5ada',
    AVAX: '#e84142'
  },
  
  // Íconos por activo (para watchlist)
  ICONS: {
    BTC: '₿',
    ETH: 'Ξ',
    SOL: '◎',
    LINK: '⬡',
    AVAX: '▲'
  },
  
  // Nombres completos
  NOMBRES: {
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
    SOL: 'Solana',
    LINK: 'Chainlink',
    AVAX: 'Avalanche'
  },
  
  // Intervalo de actualización automática (ms)
  AUTO_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutos
  
  // Configuración de animaciones
  ANIMATIONS: {
    CHART_DURATION: 1500,
    COUNTER_DURATION: 2000,
    HOVER_SCALE: 1.05,
    TRANSITION_SPEED: '0.3s'
  }
};

// Exportar configuración
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DASHBOARD_CONFIG;
}
