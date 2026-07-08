# Fitdays Progress Dashboard

Dashboard local de progreso corporal a partir de archivos CSV exportados de Fitdays.
100% en el navegador: sin backend, sin base de datos externa, sin envío de datos a internet.
Los datos procesados viven únicamente en el `LocalStorage` de tu navegador.

## Cómo usarlo

1. Abre `index.html` con doble clic, o sirve la carpeta con un servidor local simple
   (recomendado para que el Service Worker funcione correctamente):

   ```bash
   cd fitdays-dashboard
   python3 -m http.server 8080
   # abre http://localhost:8080
   ```

2. En la sección **01 · Cargar CSV**, sube tu archivo exportado de Fitdays
   (por ejemplo `Fitdays-Juan.csv`).
3. El dashboard procesa todo el archivo, lo guarda en `LocalStorage` y muestra:
   - **Overall de progreso**: primer registro vs. último registro.
   - **Semáforo**: hallazgos verdes / amarillos / rojos con explicación.
   - **Gráficas**: evolución completa de cada grupo de métricas.
   - **Tabla**: todos los registros procesados.
4. Para cargar un CSV nuevo, usa **Borrar datos** y vuelve a subir el archivo.

La app se puede **instalar como aplicación** desde el navegador (ícono "Instalar"
en la barra de direcciones en Chrome/Edge, o "Añadir a pantalla de inicio" en
iOS/Android vía Safari/Chrome).

## Estructura del proyecto

```
fitdays-dashboard/
├── index.html          # Estructura del dashboard
├── styles.css           # Estilos (tema oscuro, semáforo verde/ámbar/rojo)
├── app.js                # Parser CSV, reglas de banderas, render y gráficas
├── manifest.json         # Metadatos de la PWA
├── service-worker.js     # Cache offline del app shell
├── icon.svg              # Ícono de la app
└── README.md
```

## Uso 100% offline (sin CDN)

Por defecto, `index.html` carga dos recursos por CDN:

- **Chart.js** (`https://cdn.jsdelivr.net/npm/chart.js@4.4.4/...`)
- **Google Fonts** (Space Grotesk, Inter, IBM Plex Mono)

El Service Worker cachea el app shell, pero **no** garantiza que estos CDN estén
disponibles la primera vez sin internet. Para dejar el proyecto 100% offline:

1. Descarga Chart.js UMD y colócalo en `vendor/chart.umd.min.js`:
   ```bash
   curl -L https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js -o vendor/chart.umd.min.js
   ```
   Luego en `index.html` reemplaza la etiqueta `<script src="https://cdn.jsdelivr.net/...">`
   por `<script src="./vendor/chart.umd.min.js"></script>`.

2. Descarga las fuentes (Google Fonts Helper, fonts.google.com, o `google-webfonts-helper`)
   y sírvelas localmente con un `@font-face` en `styles.css`, reemplazando el `<link>`
   de Google Fonts en `index.html`. Si no lo haces, la app sigue funcionando pero
   usará las tipografías de respaldo del sistema.

3. Añade las rutas nuevas (`./vendor/chart.umd.min.js`, archivos de fuentes) al
   arreglo `APP_SHELL` en `service-worker.js`.

## Ajustar las reglas del semáforo

Todas las reglas de clasificación (verde/amarillo/rojo) están centralizadas en el
objeto `CONFIG` al inicio de `app.js`:

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

Para agregar una métrica nueva, añade un objeto a `CONFIG.metrics` con la clave
exacta de la columna del CSV. Si esa columna no existe en un CSV futuro, la app
simplemente la omite de overview/hallazgos sin romperse (el parser y el render
son tolerantes a columnas ausentes o con formato distinto).

## Notas sobre el parser

El parser (`parseCell` en `app.js`) interpreta celdas con formatos mixtos típicos
de Fitdays:

| Celda original          | Valor  | Mín  | Máx  | Unidad |
|--------------------------|--------|------|------|--------|
| `74.8(54.0-73.1)kg`      | 74.8   | 54.0 | 73.1 | kg     |
| `22.7%`                  | 22.7   | —    | —    | %      |
| `1618kcal`                | 1618   | —    | —    | kcal   |
| `76Points`                | 76     | —    | —    | Points |
| `-7.5kg`                  | -7.5   | —    | —    | kg     |

Columnas vacías, `--`, o llamadas `Unnamed...` se ignoran automáticamente.
Los campos de análisis segmentario (brazo/tronco/pierna, balance muscular,
impedancia bioeléctrica) se conservan en los datos crudos por registro pero no
se muestran todavía en el dashboard — quedan como base para una futura sección
de análisis segmental.

## Privacidad

- Ningún dato se envía a servidores externos.
- Todo el procesamiento del CSV ocurre en el navegador, en memoria y en `LocalStorage`.
- Los únicos recursos de red que la app intenta cargar son Chart.js y las
  tipografías (ambos opcionales — ver sección offline arriba).
