# Fitdays Progress Dashboard

Dashboard local de progreso corporal a partir de archivos CSV exportados de Fitdays.
100% en el navegador: sin backend, sin base de datos externa, sin envío de datos a internet.
Los datos procesados viven únicamente en el `LocalStorage` de tu navegador/dispositivo.

## Qué incluye

1. **Carga de CSV** — sube el export de Fitdays, se procesa y se guarda localmente.
2. **Overall de progreso** — tarjetas comparando tu primer vs. último registro por métrica.
3. **Semáforo de hallazgos** — verde/amarillo/rojo con explicación de cada cambio.
4. **Gráficas** — evolución completa (peso/IMC/grasa, masa grasa vs. muscular, agua/proteína, grasa visceral, body score, BMR, edad corporal).
5. **Progreso segmental** — tablas de grasa y balance muscular por zona del cuerpo (último registro vs. el anterior).
6. **Mapa corporal de progreso** — figura de referencia corporal con etiquetas superpuestas por zona (brazo izq./der., tronco, piernas), comparando tu primer vs. último registro, con pestañas para alternar entre Grasa y Músculo.
7. **Tabla de registros** — todos los datos procesados, de más antiguo a más reciente.

## Cómo usarlo

1. Abre `index.html` en un navegador servido por HTTP (ver sección de hosting abajo —
   abrirlo directamente como archivo `file://` no permite instalar la PWA ni usar el
   Service Worker offline).
2. En la sección **01 · Cargar CSV**, sube tu archivo exportado de Fitdays
   (por ejemplo `Fitdays-Juan.csv`).
3. El dashboard procesa todo el archivo, lo guarda en `LocalStorage` y muestra
   todas las secciones descritas arriba.
4. Para cargar un CSV nuevo, usa **Borrar datos** y vuelve a subir el archivo.

## Estructura del proyecto

```
fitdays-dashboard/
├── index.html            # Estructura del dashboard
├── styles.css             # Estilos (tema oscuro, semáforo verde/ámbar/rojo)
├── app.js                  # Parser CSV, reglas de banderas, render y gráficas
├── manifest.json           # Metadatos de la PWA
├── service-worker.js       # Cache offline del app shell
├── icon.svg                 # Ícono de la app
├── body-wireframe.png       # Figura de referencia para el mapa corporal (fondo transparente)
└── README.md
```

## Hosting — opciones

### Opción A: GitHub Pages (con internet)

1. Sube la carpeta completa del proyecto a un repositorio de GitHub.
2. El repo debe ser **público** con cuenta gratuita (Pages en repos privados requiere
   GitHub Pro/Team/Enterprise).
3. Entra a **Settings → Pages** del repo.
4. En **Build and deployment → Source**, elige **"Deploy from a branch"**.
5. Selecciona la rama (normalmente `main`) y la carpeta (`/ (root)` o `/docs` según
   dónde hayas puesto los archivos).
6. Guarda. En 1-2 minutos la URL queda activa, típicamente
   `https://tu-usuario.github.io/nombre-del-repo/`.
7. Desde el iPhone, abre esa URL en Safari → compartir → **"Añadir a pantalla de inicio"**
   para instalarla como PWA.

### Opción B: Servidor local en el propio iPhone (sin publicar en internet)

iOS bloquea el Service Worker y "Añadir a pantalla de inicio" cuando el HTML se abre
directo desde archivos (`file://`) — necesita servirse por `http://`, aunque sea local.

- **Working Copy** (cliente Git para iOS): clona el repo ahí, usa su servidor de vista
  previa integrado (`http://localhost:PORT/...`) y desde Safari añade a pantalla de inicio.
- **a-Shell** (terminal para iOS): copia el proyecto a su espacio de archivos y corre
  `python3 -m http.server 8080`, luego abre `http://localhost:8080` en Safari.

Ambas opciones mantienen todo — código y datos — dentro del propio teléfono, sin salir
a internet.

### Si el sitio no carga (troubleshooting)

Un `ERR_CONNECTION_TIMED_OUT` casi siempre es de red/deployment, no del código:
- Revisa que el último *deployment* en `Settings → Pages` (o en la pestaña **Actions**
  del repo) haya terminado en verde ✅, no en progreso.
- Prueba recargar tras 1-2 minutos (Pages puede tardar en propagar tras un push).
- Si persiste, revisa `https://www.githubstatus.com` para descartar una incidencia
  general de GitHub.

## Uso 100% offline (sin CDN)

Por defecto, `index.html` carga por CDN:

- **Chart.js** (`https://cdn.jsdelivr.net/npm/chart.js@4.4.4/...`)
- **Google Fonts** (Space Grotesk, Inter, IBM Plex Mono)

El Service Worker cachea el app shell (incluyendo `body-wireframe.png`), pero no
garantiza que estos CDN estén disponibles la primera vez sin conexión. Para dejar el
proyecto 100% offline:

1. Descarga Chart.js UMD a `vendor/chart.umd.min.js`:
   ```bash
   curl -L https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js -o vendor/chart.umd.min.js
   ```
   y en `index.html` reemplaza el `<script src="https://cdn.jsdelivr.net/...">` por
   `<script src="./vendor/chart.umd.min.js"></script>`.
2. Descarga las fuentes (Google Fonts Helper o similar) y sírvelas localmente con
   `@font-face` en `styles.css`, reemplazando el `<link>` de Google Fonts.
3. Añade las rutas nuevas al arreglo `APP_SHELL` en `service-worker.js`.

## Ajustar las reglas del semáforo

Todas las reglas de clasificación (verde/amarillo/rojo) del **overall de progreso**
están centralizadas en el objeto `CONFIG` al inicio de `app.js`:

```js
const CONFIG = {
  defaultFlatPct: 1.0,
  metrics: [
    { key: 'Weight', label: 'Peso', ruleType: 'lowerBetter', flatPct: 0.4, decimals: 1 },
    // ...
  ]
};
```

- `key`: nombre exacto de la columna en el CSV de Fitdays.
- `ruleType`: una de `lowerBetter`, `higherBetter`, `higherBetterGraded`,
  `visceralFat`, `bmr`, `targetMagnitude`, `neutral` (ver `METRIC_RULES` en `app.js`).
- `flatPct` / `amberFloorPct`: umbrales de cambio porcentual para decidir la bandera.
- `decimals`: decimales mostrados.

Para agregar una métrica nueva, añade un objeto a `CONFIG.metrics` con la clave exacta
de la columna del CSV. Si esa columna no existe en un CSV futuro, la app la omite de
overview/hallazgos sin romperse.

Las reglas de **progreso segmental** (grasa/músculo por zona) son independientes y
viven en `classifySegmentalDelta()`: grasa mejora al bajar, músculo mejora al
subir/mantenerse, con un umbral fijo de 0.15 kg para considerar "sin cambio".

## Progreso segmental y mapa corporal

El parser detecta automáticamente las columnas de análisis segmental del CSV de
Fitdays, tolerando variaciones de nombre (incluye el typo `repot_` en vez de
`report_`, y mayúsculas mixtas como `left_Arm`):

- `repot_left_Arm-@Segmental fat analysis`, `..._right_Arm...`, `..._trunk...`,
  `..._left_leg...`, `..._right_Leg...` → grasa por zona.
- Las mismas variantes con `-@Muscle balance` → balance muscular por zona.

Formato de celda esperado: `(0.9kg/150.2%/Standard)` → se extrae el valor en kg.

Si el CSV no trae estas columnas, ambas secciones (**05** y **06**) se ocultan solas
sin afectar el resto del dashboard.

### Ajustar la posición de las etiquetas del mapa corporal

Las etiquetas flotantes sobre `body-wireframe.png` se posicionan con porcentajes
`left`/`top` directamente en `index.html`, dentro de `.body-photo-frame`:

```html
<div class="body-callout" id="callout-leftArm" style="left:15%; top:40%;">...</div>
```

Si alguna cae mal ubicada u otra etiqueta se le encima (por ejemplo si cambias la
imagen de referencia), ajusta esos porcentajes — no requiere tocar `app.js`, solo
`index.html`. Los valores actuales:

| Zona             | left  | top |
|------------------|-------|-----|
| Brazo izquierdo  | 15%   | 40% |
| Brazo derecho    | 85%   | 40% |
| Tronco           | 50%   | 26% |
| Pierna izquierda | 18%   | 80% |
| Pierna derecha   | 82%   | 80% |

## Notas sobre el parser

El parser (`parseCell` en `app.js`) interpreta celdas con formatos mixtos típicos de
Fitdays:

| Celda original          | Valor  | Mín  | Máx  | Unidad |
|--------------------------|--------|------|------|--------|
| `74.8(54.0-73.1)kg`      | 74.8   | 54.0 | 73.1 | kg     |
| `22.7%`                  | 22.7   | —    | —    | %      |
| `1618kcal`                | 1618   | —    | —    | kcal   |
| `76Points`                | 76     | —    | —    | Points |
| `-7.5kg`                  | -7.5   | —    | —    | kg     |

Columnas vacías, `--`, o llamadas `Unnamed...` se ignoran automáticamente.

**Nota sobre CSVs en otro idioma/locale:** si un CSV viene con encabezados traducidos
(ej. `Peso` en vez de `Weight`), fechas en español (`ago`, `ene`), separador decimal
de coma (`74,8`) o separador de columnas `;` en vez de `,`, el parser actual no lo
reconocerá — estas columnas simplemente no tendrán datos, sin romper la app, pero
tampoco se completará el overview. Si necesitas soportar un CSV así, avisa para
extender `parseCell`/`parseFitdaysDate`/`splitCsvLine` con las variantes correspondientes.

## Privacidad

- Ningún dato se envía a servidores externos.
- Todo el procesamiento del CSV ocurre en el navegador, en memoria y en `LocalStorage`.
- Los únicos recursos de red que la app intenta cargar son Chart.js y las tipografías
  (ambos opcionales — ver sección offline arriba). La imagen `body-wireframe.png` y
  todo el resto del código se sirven localmente.
