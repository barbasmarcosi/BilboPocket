# BilboPocket

PWA gratuita, **local-first**, para registrar entrenamientos del Método Bilbo, gestionar ciclos de progresión, administrar días de entrenamiento y analizar sesiones. Es un proyecto independiente, sin afiliación a Bilbo Team ni a Jesús Varela.

## Funciones

- Sesiones de empuje/tirón/piernas editables; ejercicios propios y series complementarias.
- Registro de series Bilbo (peso, repeticiones, RIR, percepción de velocidad).
- Ciclos por ejercicio con incremento, carga inicial y mínimo de repeticiones configurables.
- Sugerencias **no automáticas**: aumentar carga si hay margen de repeticiones y velocidad adecuada; mantener si RIR bajo o velocidad lenta; revisar fin de ciclo al alcanzar el límite inferior.
- Borradores recuperables, repetición de ejercicios y estructura previa, temporizador de descansos.
- Historial, métricas de volumen y análisis de carga/repeticiones por ejercicio y por ciclo.
- Instalable como PWA, disponible sin conexión después de su primera carga.
- Copias de seguridad JSON exportables e importables, validación básica del archivo, confirmación antes de reemplazar o borrar.

## Privacidad y límites

**Los datos permanecen exclusivamente en el almacenamiento local del navegador.** No hay cuenta, telemetría ni sincronización. Limpiar datos del navegador o cambiar de dispositivo puede borrar el historial; exportá respaldos JSON periódicamente. Esta versión registra cargas en kilogramos. Las recomendaciones no son una prescripción individual y la app no sustituye el criterio del entrenador. Nunca persigas el fallo o la velocidad a costa de la técnica.

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
