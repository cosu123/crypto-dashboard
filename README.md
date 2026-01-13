# 🚀 Heidi Crypto Portfolio Dashboard

Dashboard profesional de portafolio cripto con sincronización en tiempo real con Google Sheets. Diseñado con una interfaz futurista y funcionalidad completa tanto online como offline.

## ✨ Características

- **📊 Sincronización en Tiempo Real**: Conectado directamente con Google Sheets para actualizaciones automáticas
- **💼 KPIs Dinámicos**: Visualización de métricas clave del portafolio
- **📈 Gráficos Interactivos**: Evolución de precios y distribución del portafolio
- **🌐 Funcionalidad Offline**: Service Worker para acceso sin conexión
- **📱 PWA (Progressive Web App)**: Instalable como aplicación nativa
- **🎨 Tema Claro/Oscuro**: Interfaz adaptable con diseño glassmorphism
- **⚡ Auto-actualización**: Refresco automático cada 5 minutos
- **📋 Tabla de Transacciones**: Historial completo de operaciones

## 🔗 Enlaces

- **Dashboard en Vivo**: [https://cosu123.github.io/crypto-dashboard/](https://cosu123.github.io/crypto-dashboard/)
- **Google Sheet**: [Ver Hoja de Cálculo](https://docs.google.com/spreadsheets/d/1Bx0NizfyQjrLVkuHRLcWBK1_ZOFSRtF9vOql4IV5Ap4/edit?usp=sharing)
- **Repositorio**: [https://github.com/cosu123/crypto-dashboard](https://github.com/cosu123/crypto-dashboard)

## 🛠️ Tecnologías

- **HTML5 + CSS3**: Diseño responsive con variables CSS
- **JavaScript Vanilla**: Sin frameworks, máximo rendimiento
- **Chart.js**: Gráficos interactivos y animados
- **Google Sheets API**: Integración directa sin autenticación
- **Service Worker**: Caché inteligente para modo offline
- **PWA**: Manifest y Service Worker para instalación

## 📦 Estructura del Proyecto

```
crypto-dashboard/
├── index.html          # Página principal del dashboard
├── app.js             # Lógica de la aplicación y API de Google Sheets
├── sw.js              # Service Worker para funcionalidad offline
├── manifest.json      # Manifest de PWA
└── README.md          # Documentación
```

## 🚀 Despliegue

El dashboard está desplegado automáticamente en **GitHub Pages**. Cualquier cambio en la rama `main` se reflejará automáticamente en el sitio en vivo.

### Actualizar el Dashboard

1. Realiza cambios en los archivos
2. Commit y push a la rama `main`:
   ```bash
   git add .
   git commit -m "Actualización del dashboard"
   git push origin main
   ```
3. Los cambios se desplegarán automáticamente en minutos

## 📊 Configuración de Google Sheets

El dashboard está configurado para leer datos de las siguientes hojas:

- **Portafolio**: Transacciones y datos principales
- **_Hist_Precios**: Historial de precios de activos
- **Checklist_Semanal**: Control semanal (opcional)

### Requisitos del Google Sheet

1. El Google Sheet debe ser **público** (cualquier persona con el enlace puede ver)
2. Las hojas deben tener los encabezados correctos:
   - **Portafolio**: Fecha, Activo, Inversión USDT, Tipo, Orden, Exchange/Plataforma, Cantidad/Moneda Crypto, Precio Compra, Precio Venta, Precio Actual
   - **_Hist_Precios**: FechaISO, Activo, Precio

### Cambiar el Google Sheet

Para conectar el dashboard a otro Google Sheet:

1. Abre `app.js`
2. Modifica la constante `SHEET_ID` con el nuevo ID:
   ```javascript
   const SHEET_ID = 'TU_NUEVO_SHEET_ID';
   ```
3. Guarda y despliega los cambios

## 🎨 Personalización

### Cambiar Colores de Activos

En `app.js`, modifica el objeto `colors`:

```javascript
const colors = {
  'BTC': '#f7931a',
  'ETH': '#627eea',
  'SOL': '#14f195',
  'LINK': '#2a5ada',
  'AVAX': '#e84142'
};
```

### Ajustar Frecuencia de Actualización

En `app.js`, modifica el intervalo (en milisegundos):

```javascript
// Auto-actualizar cada 5 minutos (300000 ms)
setInterval(refreshData, 5 * 60 * 1000);
```

### Modificar Tema

Los colores del tema se definen en las variables CSS en `index.html`:

```css
:root {
  --accent1: #7a47f3;
  --accent2: #4dd6ff;
  --accent3: #49f5a6;
  /* ... más variables */
}
```

## 📱 Instalar como PWA

### En Móvil (iOS/Android)

1. Abre el dashboard en el navegador
2. Toca el menú de opciones (⋮ o compartir)
3. Selecciona "Agregar a pantalla de inicio"
4. La app se instalará como aplicación nativa

### En Desktop (Chrome/Edge)

1. Abre el dashboard en el navegador
2. Busca el ícono de instalación en la barra de direcciones
3. Haz clic en "Instalar"
4. La app se abrirá en una ventana independiente

## 🔧 Desarrollo Local

Para probar el dashboard localmente:

```bash
# Clonar el repositorio
git clone https://github.com/cosu123/crypto-dashboard.git
cd crypto-dashboard

# Iniciar un servidor local
python3 -m http.server 8000

# Abrir en el navegador
open http://localhost:8000
```

## 📈 Métricas del Dashboard

El dashboard calcula automáticamente:

- **Total Invertido**: Suma de todas las inversiones en USDT
- **Valor Actual**: Valor total del portafolio en USDT
- **P&L Total**: Ganancia/Pérdida total (absoluta y porcentual)
- **Activos**: Número de criptomonedas diferentes
- **Transacciones**: Total de operaciones registradas
- **Exchanges**: Número de plataformas utilizadas

## 🌐 Modo Offline

El dashboard funciona completamente offline gracias al Service Worker:

- **Primera visita**: Descarga y cachea todos los assets
- **Visitas posteriores**: Carga instantánea desde caché
- **Sin conexión**: Muestra los últimos datos sincronizados
- **Reconexión**: Actualiza automáticamente los datos

## 🐛 Solución de Problemas

### El dashboard no carga datos

1. Verifica que el Google Sheet sea público
2. Comprueba la consola del navegador (F12) para errores
3. Intenta refrescar manualmente con el botón "Actualizar"

### Los gráficos no se muestran

1. Verifica que Chart.js se haya cargado correctamente
2. Asegúrate de que hay datos en el Google Sheet
3. Limpia la caché del navegador y recarga

### El Service Worker no funciona

1. Asegúrate de estar usando HTTPS (GitHub Pages lo usa por defecto)
2. Verifica en DevTools > Application > Service Workers
3. Intenta desregistrar y volver a registrar el Service Worker

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👤 Autor

**cosu123**
- GitHub: [@cosu123](https://github.com/cosu123)

## 🙏 Agradecimientos

- [Chart.js](https://www.chartjs.org/) por los gráficos interactivos
- [Google Sheets](https://sheets.google.com/) por la API pública
- [Inter Font](https://rsms.me/inter/) por la tipografía

---

**Última actualización**: Enero 2026
