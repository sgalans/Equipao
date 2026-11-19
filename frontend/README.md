# Equipao — frontend

Guía de desarrollo. Qué es la app y su arquitectura: [README del repositorio](../README.md).

## Puesta en marcha

En PowerShell, desde la raíz del repositorio:

```powershell
nvm use        # versión de Node indicada en .nvmrc
cd frontend
npm ci         # instala exactamente las versiones de package-lock.json
npm run dev
```

`npm ci` reproduce el lockfile; para añadir o actualizar dependencias se usa `npm install`, que lo modifica. El lockfile se guarda en Git; `node_modules`, no.

## Scripts

| Script            | Para qué                                                         |
| ----------------- | ---------------------------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo (`-- --host` para abrirlo desde el móvil) |
| `npm test`        | Tests en modo _watch_: se repiten al guardar                     |
| `npm run check`   | **Antes de cada commit**: typecheck + lint + formato + tests     |
| `npm run build`   | Versión de producción en `dist/`                                 |
| `npm run preview` | Sirve `dist/` para revisarla                                     |
| `npm run format`  | Aplica Prettier                                                  |

`check` agrupa `typecheck`, `lint`, `format:check` y `test:run`, de la más rápida a la más lenta, y se detiene en el primer fallo. Cada una detecta cosas que las otras no: Vitest no comprueba tipos, y el lint encuentra problemas que ni los tests ni `tsc` ven.

## Estructura

```
src/
  app/                composition root, rutas, layout y páginas generales
  features/<feature>/
    domain/           esquemas Zod, reglas puras y ports (interfaces)
    application/      casos de uso entre varios repositorios
    data/             adapters Dexie (+ sus tests de integración)
    ui/               componentes, pantallas y estilos (*.module.css)
  shared/
    db/               esquema de Dexie y migraciones
    di/               RepositoriesContext + useRepositories()
    domain/           errores de dominio y esquemas comunes
    ui/               componentes y estilos reutilizables
  test/               helpers de tests (BD aislada, renderApp…)
```

Imports con alias: `@/` = `src/`.

## Tests

- `*.test.ts` se ejecuta en Node (dominio y repositorios) y `*.test.tsx` en jsdom (componentes). Son dos proyectos de Vitest, para que la lógica pura no pague el arranque del DOM simulado.
- Los repositorios se prueban contra una IndexedDB en memoria (`fake-indexeddb`): cada test crea una base de datos propia con `createTestRepositories()`.
- Las pantallas se prueban de punta a punta con `renderApp(ruta, repositorios)`, que monta las rutas reales. Los elementos se buscan por rol y nombre accesible, como lo haría un usuario o un lector de pantalla.
- Lo que jsdom no puede reproducir (gestos táctiles, foco atrapado en `<dialog>`) se deja para tests E2E en un navegador real.

## Avisos conocidos

- `npm audit` muestra avisos moderados de `minimatch`, dependencia transitiva de las herramientas de lint (no llega a la app). La corrección automática (`audit fix --force`) degradaría esas herramientas, así que no se ha aplicado.
- TypeScript se mantiene en la línea 6.0 por compatibilidad con `typescript-eslint`.
