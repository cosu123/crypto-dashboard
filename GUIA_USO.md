# 📱 Guía Rápida de Uso - Crypto Dashboard

## 🚀 Acceso al Dashboard

**URL del Dashboard**: [https://cosu123.github.io/crypto-dashboard/](https://cosu123.github.io/crypto-dashboard/)

El dashboard se actualiza automáticamente cada vez que modificas el Google Sheet.

---

## 📊 Características Principales

### 1. **Sincronización Automática**

El dashboard se conecta directamente a tu Google Sheet y actualiza los datos:
- **Automáticamente**: Cada 5 minutos
- **Manualmente**: Haciendo clic en el botón "↻ Actualizar"
- **Al cargar**: Cada vez que abres o recargas la página

### 2. **KPIs en Tiempo Real**

En la parte superior verás 6 métricas clave:

| Métrica | Descripción |
|---------|-------------|
| **Total Invertido** | Suma de todas tus inversiones en USDT |
| **Valor Actual** | Valor total de tu portafolio en USDT |
| **P&L Total** | Ganancia/Pérdida total ($ y %) |
| **Activos** | Número de criptomonedas diferentes |
| **Transacciones** | Total de operaciones registradas |
| **Exchanges** | Número de plataformas que usas |

### 3. **Gráficos Interactivos**

**Evolución de Precios**
- Muestra el historial de precios de tus principales activos
- Pasa el mouse sobre las líneas para ver valores exactos
- Los colores representan diferentes criptomonedas

**Distribución del Portafolio**
- Gráfico circular que muestra la proporción de cada activo
- Indica qué porcentaje de tu portafolio representa cada cripto
- Útil para ver si estás diversificado

### 4. **Tabla de Transacciones**

Muestra las últimas 20 transacciones con:
- Fecha de la operación
- Activo comprado/vendido
- Tipo de orden (Market, Límite, Auto)
- Inversión en USDT
- Cantidad de crypto
- Precio de compra

---

## 🎨 Personalización

### Cambiar Tema (Claro/Oscuro)

Haz clic en el botón **☀️** o **🌙** en la esquina superior derecha para alternar entre:
- **Tema Oscuro**: Ideal para uso nocturno, reduce fatiga visual
- **Tema Claro**: Mejor para ambientes con mucha luz

El tema se guarda automáticamente y se mantiene en futuras visitas.

---

## 📱 Instalar como Aplicación (PWA)

Puedes instalar el dashboard como una aplicación nativa en tu dispositivo:

### En Móvil (Android/iOS)

1. Abre el dashboard en tu navegador móvil
2. Toca el menú del navegador (⋮ o compartir)
3. Selecciona **"Agregar a pantalla de inicio"** o **"Instalar app"**
4. La app aparecerá en tu pantalla de inicio como cualquier otra aplicación

### En Computadora (Chrome/Edge)

1. Abre el dashboard en Chrome o Edge
2. Busca el ícono de instalación (➕) en la barra de direcciones
3. Haz clic en **"Instalar"**
4. La app se abrirá en una ventana independiente

**Ventajas de instalar como PWA:**
- Acceso rápido desde tu pantalla de inicio
- Funciona sin conexión (modo offline)
- Experiencia de aplicación nativa
- No ocupa espacio en la barra de marcadores

---

## 🌐 Modo Offline

El dashboard funciona **completamente sin conexión** gracias a la tecnología Service Worker:

### ¿Cómo funciona?

1. **Primera visita**: El dashboard descarga y guarda todos los archivos necesarios
2. **Visitas posteriores**: Carga instantáneamente desde la memoria caché
3. **Sin conexión**: Muestra los últimos datos sincronizados
4. **Reconexión**: Actualiza automáticamente los datos cuando vuelves online

### Indicador de Estado

En la esquina superior derecha verás:
- **● En línea** (verde): Conectado y sincronizando
- **● Sin conexión** (amarillo): Modo offline, mostrando datos en caché
- **● Sincronizando...** (gris): Cargando datos del Google Sheet

---

## 🔄 Actualizar Datos del Google Sheet

Para que el dashboard muestre información actualizada:

### Paso 1: Editar el Google Sheet

1. Abre tu Google Sheet: [Ver Hoja](https://docs.google.com/spreadsheets/d/1Bx0NizfyQjrLVkuHRLcWBK1_ZOFSRtF9vOql4IV5Ap4/edit?usp=sharing)
2. Edita los datos en cualquier hoja:
   - **Portafolio**: Transacciones y datos principales
   - **_Hist_Precios**: Historial de precios
   - **Otros**: Resúmenes y controles
3. Los cambios se guardan automáticamente en Google Sheets

### Paso 2: Ver los Cambios en el Dashboard

**Opción A - Esperar (recomendado)**
- El dashboard se actualiza automáticamente cada 5 minutos
- Solo espera y verás los cambios reflejados

**Opción B - Actualización Manual**
- Haz clic en el botón **"↻ Actualizar"** en la esquina superior derecha
- Los datos se cargarán inmediatamente

**Opción C - Recargar Página**
- Presiona **F5** o **Ctrl+R** (Cmd+R en Mac)
- Para forzar recarga sin caché: **Ctrl+Shift+R** (Cmd+Shift+R en Mac)

---

## 🛠️ Solución de Problemas

### El dashboard no carga datos

**Posibles causas y soluciones:**

1. **Google Sheet no es público**
   - Verifica que el Sheet tenga permisos de "Cualquier persona con el enlace puede ver"
   - Ve a Compartir → Cambiar a "Cualquier persona con el enlace"

2. **Problemas de conexión**
   - Verifica tu conexión a internet
   - Intenta recargar la página con Ctrl+F5

3. **Caché del navegador**
   - Limpia la caché del navegador
   - Abre el dashboard en modo incógnito para probar

### Los gráficos no se muestran

1. **Verifica que hay datos en el Google Sheet**
   - Al menos debe haber transacciones con valores válidos
   - Revisa que las columnas tengan los nombres correctos

2. **Actualiza la página**
   - Presiona Ctrl+Shift+R para forzar recarga

3. **Prueba en otro navegador**
   - Chrome, Firefox, Edge o Safari

### Las fechas no se muestran correctamente

1. **Formato de fecha en Google Sheet**
   - Debe ser: YYYY-MM-DD HH:MM:SS
   - Ejemplo: 2024-10-23 19:07:57

2. **Actualiza el dashboard**
   - Las últimas correcciones mejoran el parseo de fechas

### El modo offline no funciona

1. **Verifica que estás usando HTTPS**
   - GitHub Pages usa HTTPS por defecto
   - Service Workers solo funcionan en HTTPS

2. **Navegador compatible**
   - Chrome, Firefox, Edge, Safari (iOS 11.3+)
   - Internet Explorer no es compatible

---

## 📞 Soporte

Si tienes problemas o preguntas:

1. **Revisa esta guía** - La mayoría de problemas tienen solución aquí
2. **Verifica la consola del navegador** - Presiona F12 y busca errores en la pestaña "Console"
3. **Revisa el README** - [Ver README.md](README.md) para información técnica detallada

---

## 🎯 Consejos Pro

### Maximiza la Utilidad del Dashboard

1. **Mantén el Google Sheet actualizado**
   - Registra todas tus transacciones
   - Actualiza los precios regularmente

2. **Usa el modo PWA**
   - Instala como aplicación para acceso rápido
   - Funciona offline cuando no tienes internet

3. **Revisa los KPIs regularmente**
   - Monitorea tu P&L para tomar decisiones informadas
   - Verifica la distribución de tu portafolio

4. **Aprovecha los gráficos**
   - Identifica tendencias en los precios
   - Asegúrate de estar diversificado

5. **Personaliza el tema**
   - Usa tema oscuro de noche
   - Tema claro durante el día

---

**Última actualización**: Enero 2026  
**Versión del Dashboard**: 1.0.0
