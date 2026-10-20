# BilboPocket

PWA gratuita, **local-first**, para registrar entrenamientos del Método Bilbo, gestionar ciclos de progresión, administrar días de entrenamiento y analizar sesiones. Es un proyecto independiente, sin afiliación a Bilbo Team ni a Jesús Varela.

## Funciones

- Sesiones de empuje/tirón/piernas editables; ejercicios propios y series complementarias.
- Registro de series Bilbo (peso, repeticiones, RIR, percepción de velocidad).
- Ciclos por ejercicio con incremento, carga inicial y mínimo de repeticiones configurables.
- Sugerencias **no automáticas**: aumentar carga si hay margen de repeticiones y velocidad adecuada; mantener si RIR bajo o velocidad lenta; revisar fin de ciclo al alcanzar el límite inferior.
- Borradores recuperables, repetición de ejercicios y estructura previa, temporizador de descansos.
- Historial, métricas de volumen y análisis de carga/repeticiones por ejercicio y por ciclo.
- **1RM estimada según el Excel Bilbo** a partir de cada serie (`peso × (1 + 0,03 × repeticiones)`), mostrada en vivo en el entrenamiento, en el historial y en una gráfica por ejercicio, con récord y variación desde el primer registro. La fórmula no incorpora el RIR y no equivale a una 1RM real.
- Instalable como PWA, disponible sin conexión después de su primera carga.
- Copias de seguridad JSON exportables e importables, validación básica del archivo, confirmación antes de reemplazar o borrar.

## Importación de Excel Bilbo

Desde **Ajustes → Importar Excel Bilbo** se pueden seleccionar planillas modernas `.xlsx` y `.xlsm` o archivos `.csv`. La lectura ocurre **en el navegador**, sin enviarse a ningún servidor y sin servicios externos ni dependencias de terceros. El formato antiguo `.xls` debe guardarse previamente como `.xlsx`.

- Se reconocen tablas con **Peso** y **Repeticiones**, incluidos los encabezados repetidos por ciclo de las planillas V15 del Método Bilbo (Fecha, Día, Peso, Repeticiones, trabajo, 1RM), y tablas más generales con fecha/ejercicio/ciclo/RIR.
- Solo se incorporan series **realmente completadas**, con peso y repeticiones válidos. Se omiten las filas de cargas futuras con repeticiones en blanco o cero.
- Antes de guardar aparece una **vista previa** y la posibilidad de seleccionar el ejercicio de cada hoja. Si existe una columna Ejercicio se reconocen también los movimientos de cada fila; los nombres desconocidos heredan la asignación elegida para esa hoja.
- Las **fechas ausentes no se inventan**: esas filas se omiten salvo que se marque expresamente una fecha común antes de importar.
- Se importan como **sesiones históricas** y ciclos cerrados, sin reemplazar sesiones ni ciclos activos. La reimportación del mismo archivo no debe duplicar las series detectadas.
- Cuando el Excel no guarda RIR o velocidad, ambos quedan sin información en el registro; no se inventan valores. La 1RM estimada se vuelve a calcular con el peso y las repeticiones importados.
- La PWA conserva los archivos lectores para importación sin conexión una vez instalada. El historial sigue guardándose en este dispositivo, por lo que conviene exportar un respaldo antes de operaciones importantes.

Para Excel personalizados sin columnas reconocibles, adaptar o exportar la hoja como CSV con encabezados **Fecha, Ejercicio, Peso, Repeticiones**, incluyendo, cuando se conozcan, RIR y Ciclo.

## Privacidad y límites

**Los datos permanecen exclusivamente en el almacenamiento local del navegador.** No hay cuenta, telemetría ni sincronización. Limpiar datos del navegador o cambiar de dispositivo puede borrar el historial; exportá respaldos JSON periódicamente. Esta versión registra cargas en kilogramos. La 1RM estimada es orientativa y pierde precisión con series de muchas repeticiones o realizadas lejos del límite técnico. Las recomendaciones no son una prescripción individual y la app no sustituye el criterio del entrenador. Nunca persigas el fallo o la velocidad a costa de la técnica.

## Estructura y desarrollo

PWA sin dependencias de runtime ni servicio servidor. HTML/CSS/JavaScript ES modules, Service Worker con shell offline, tests de dominio con `node:test`.

```bash
npm run check
npm test
npm run build
python3 -m http.server 8000 -d site
```

Navegá a `http://localhost:8000`. Los service workers funcionan en localhost o HTTPS.

## Deploy en GitHub Pages

Workflow: `.github/workflows/deploy.yml`. Cada push a `main` valida, ejecuta tests, sube `site/` y despliega mediante GitHub Actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`). En Settings → Pages, elegí **GitHub Actions** como origen si el sitio todavía no fue habilitado.

Dirección prevista: https://barbasmarcosi.github.io/BilboPocket/

## Nota sobre el Método Bilbo

BilboPocket registra una interpretación **configurable** del seguimiento de ciclos; no reproduce un programa privado, oficial o individualizado. Más información en https://bilboteam.com/.

## Próximos incrementos sugeridos

Edición retrospectiva de sesiones, importación incremental en vez de reemplazo, métricas por mesociclo, simulador de progresión, almacenamiento IndexedDB y sincronización cifrada opcional entre dispositivos.
