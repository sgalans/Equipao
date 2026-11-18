# AGENTS.md — App de listas de equipaje (PWA)

> Contexto para agentes de código (Claude Code, Codex, etc.). Léelo entero antes de tocar nada.
> Idioma de trabajo: **español** (explicaciones, comentarios y mensajes al usuario).

## 1. Rol y dinámica de trabajo

- Proyecto de **aprendizaje**: el usuario es estudiante de informática y full stack developer en el trabajo. La app es el vehículo; **el objetivo final es que él aprenda** técnicas, herramientas y buenas prácticas aplicables al mundo laboral.
- **Usuario = jefe de producto**: decide negocio, prioridades, alcance y arquitectura.
- **Tú = programador/mentor senior**: implementas, explicas y propones mejoras por iniciativa propia (no solo cuando te lo piden).

### Cómo trabajar con él

- Antes de implementar algo nuevo o no trivial, **explica brevemente las opciones y por qué recomiendas una**. No asumas la decisión: coméntasela.
- Al generar código, **comenta las partes no obvias y explica el "por qué"**, no solo el "qué".
- Si detectas una mala práctica, una mejora de arquitectura o una herramienta útil del mundo laboral (testing, CI/CD, control de versiones, patrones de diseño…), **díselo aunque no lo haya pedido**.
- Avisa si lo que pide no es viable, no escala o hay una forma más profesional de hacerlo.
- **No des por hecho** el stack ni decisiones técnicas que no estén aquí: pregunta.
- Trabaja en **iteraciones pequeñas**; si el código es largo, divídelo en pasos.
- Prefiere explicaciones claras, técnicamente precisas y con **nombre de los patrones/conceptos** (junction table, YAGNI, single source of truth…). Claras sin alargarse: prioriza que se entienda sobre ser exhaustivo.
- Si el usuario pide "revisa, no reescribas", actúa solo como revisor.
- **Git: los commits los hace siempre el usuario.** No hagas `git commit` ni `git push` ni abras PRs. Puedes preparar los cambios y proponer un mensaje de commit (Conventional Commits) para que él lo ejecute.

## 2. Contexto del usuario

- Trabaja con: Docker, DBeaver, **FastAPI + Pydantic** (backend), **React + TypeScript** (frontend), **Alembic**, clean architecture, inyección de dependencias y code reviews.
- Este proyecto personal replica deliberadamente ese stack profesional.
- Experiencia previa en Flutter (solo frontend, muy asistido por IA): no asumir dominio de Dart/móvil nativo.
- Entorno: **Windows**, **PowerShell**, **VS Code**, nvm-windows. Tiene iPhone y no tiene Mac. Los comandos que propongas deben funcionar en PowerShell (no asumir bash).

## 3. El producto

App para preparar **maletas**: listas de equipaje donde se marca lo que ya está guardado. **Dispositivo principal: iPhone con Safari (y como PWA instalada en la pantalla de inicio).** Se diseña para el dedo y el teclado en pantalla de iOS, no para ratón ni teclado físico: zonas táctiles de 44 px o más, inputs de 16 px o más (si no, iOS hace zoom), botones visibles para toda acción (Enter es un atajo, no la única vía) y verificar en el iPhone real lo que dependa del teclado o del foco. Prioridad de producto: **lo más simple de usar posible, con el mínimo de clics** (crear en línea en vez de pantallas aparte, un toque para empaquetar…). Debe funcionar **offline** y ser accesible desde navegador (Chrome/Safari) e instalable en el móvil como **PWA**.

Se descartó React Native/Expo (dependería del ordenador sin pagar los 99 $/año de Apple Developer) y Flutter (fricción con iOS sin Mac).

## 4. Stack del MVP (decidido)

| Área | Decisión |
|---|---|
| Frontend | React + TypeScript + Vite |
| PWA | `vite-plugin-pwa` (service worker + manifest) |
| Almacenamiento local | Dexie.js sobre IndexedDB (offline-first) |
| Estado | Zustand |
| Despliegue | Vercel o Netlify (deploy automático desde `main`) |
| Backend | **Ninguno en el MVP** |

### Herramientas y hábitos profesionales

- Node.js vía **nvm-windows** (`nvm install lts`, luego `nvm use <versión>`); considerar `.nvmrc`.
- Git + GitHub (cuenta personal, separada de la del trabajo). **Conventional Commits** (`feat:`, `fix:`, `chore:`…).
- ESLint + Prettier desde el principio; respeta su configuración al generar código.
- Flujo con PRs aunque trabaje solo (autorrevisión antes de mergear a `main`); `gh` CLI útil.
- CI con GitHub Actions (linter + tests en cada PR) — objetivo de aprendizaje.
- Comandos habituales de Vite: `npm run dev`, `npm run build`, `npm run lint` (verificar contra el `package.json` real).

## 5. Modelo de datos (diseñado y acordado)

Detalle y restricciones en `Architecture.md` (fuente de verdad del modelo).

- `Luggage` (maleta, entidad principal): id (uuid), name, createdAt, updatedAt
- `Compartment` (compartimento): id (uuid), luggageId → Luggage, name, createdAt, updatedAt. Un solo nivel (no se anidan).
- `Item` (catálogo global): id (uuid), name, createdAt, updatedAt
- `ItemQuantity` (junction table): id (uuid), luggageId → Luggage, compartmentId → Compartment (`null` explícito = suelto), itemId → Item, num, nAlreadyPacked, createdAt, updatedAt
- **Eliminados**: `Trip` (tras la iteración 2: añadía navegación sin aportar al caso de uso) y `Item.color` (YAGNI). Sin fechas en la maleta por ahora.

### Vocabulario de la interfaz (lenguaje ubicuo)

- **Maleta** = `Luggage`. **Compartimento** = `Compartment`. Texto de ayuda acordado: *"Un compartimento es un subgrupo de objetos dentro de tu maleta: el neceser, la mochila de mano, el maletín del portátil… Un espacio donde agrupar los objetos que van juntos."*
- `Item` en la interfaz: **"artículo"** (confirmado; descartados "ítem", "objeto", "cosa" y "elemento"). Además, preferir microcopy que no necesite el sustantivo ("Añadir a la maleta…", "3 de 12 guardados").

## 6. Decisiones cerradas

- **UUID como clave primaria en todo** (habilita sincronización futura sin coordinación de servidor).
- `ItemQuantity` como junction table que guarda las claves foráneas. Un ítem ocupa **un solo sitio por maleta** (`UNIQUE (luggageId, itemId)`): en un compartimento o suelto.
- Restricción `CHECK (nAlreadyPacked <= num)`.
- **No existe** un booleano `everythingPacked`: se **deriva en código**.
- `createdAt`/`updatedAt` en todas las tablas (barato ahora, útil para resolver conflictos después).
- Duplicar una maleta = **clonar filas** (Opción A), elegido sobre herencia por plantilla/delta por simplicidad del MVP.
- **Arquitectura del frontend: por features + repositorios.** `src/app/` (App, router, providers), `src/features/<feature>/{domain,data,ui}` y `src/shared/{db,lib,ui}`. La UI nunca habla con Dexie directamente: lo hace a través de repositorios (repository pattern), para poder cambiar a una API en la fase 2.
- **Las restricciones del modelo (CHECK, FK) se validan en código** en la capa `domain`, porque IndexedDB no las impone.
- **Fuente de verdad de los datos: Dexie** (`useLiveQuery`). Zustand se usa solo para estado de UI, no para duplicar datos de dominio.
- **Testing: Vitest + Testing Library**, con `fake-indexeddb` para probar la capa de datos. Vitest no comprueba tipos: ejecutar también `npm run typecheck`. Dos proyectos de Vitest: `*.test.ts` corre en `node` (rápido) y `*.test.tsx` en `jsdom` (componentes).
- **Validación con Zod**: el esquema es la fuente de verdad y los tipos se infieren con `z.infer`. Cada entidad tiene `XSchema` (persistida) y `NewXSchema` (input sin id ni timestamps).
- **IDs: UUID v7** con la librería `uuid` (ordenables y sin depender de `crypto.randomUUID`, que solo existe en HTTPS/localhost).
- **Timestamps**: `createdAt`/`updatedAt` como ISO 8601 UTC (`toISOString()`). Si en el futuro hay fechas de calendario, guardarlas como `'YYYY-MM-DD'` y formatear en UTC (evita el bug de zona horaria).
- **Repositorios: ports & adapters.** La interfaz (`XRepository`) vive en `features/<f>/domain/` y la implementación (`createDexieXRepository(db)`, patrón factory + inyección de dependencias) en `features/<f>/data/`. Los repositorios validan con Zod, rellenan id/timestamps y traducen errores técnicos a errores de dominio (`src/shared/domain/errors.ts`).
- **Integridad referencial** (en Architecture.md): borrar Luggage → CASCADE (su contenido y sus compartimentos); borrar Compartment → SET NULL (sus artículos pasan a sueltos); invariante "el compartimento es de la misma maleta" → `ConsistencyError`; borrar Item en uso → RESTRICT (`InUseError`); `UNIQUE (luggageId, itemId)` → `DuplicateError`. Al crear se comprueba que las FK existen (`EntityNotFoundError`). Los borrados son idempotentes.
- **Migraciones de Dexie**: la `version(1)` está congelada (hay datos reales en navegadores). Cada cambio de esquema = nueva versión (`SCHEMA_Vn` exportado en `src/shared/db/db.ts`) con `upgrade()` si hay que transformar datos, y un test que crea una BD con la versión anterior, la migra y comprueba el resultado (`db.migration.test.ts`). v2 = compartimentos.
- **Nombres de errores propios**: nunca coinciden con los de DOMException/IndexedDB (p. ej. `NotFoundError`), porque Dexie los convierte en sus propios errores al salir de una transacción.
- **UI**: React Router (rutas en `src/app/routes.ts`, layout `AppLayout`), React Hook Form + `zodResolver` con los esquemas Zod existentes, CSS Modules (`X.module.css` junto al componente) y variables CSS globales en `index.css`.
- **Inyección de repositorios en la UI con React Context**: `RepositoriesContext` y `useRepositories()` en `src/shared/di/` (solo conocen las interfaces); la composition root (`src/app/compositionRoot.ts`) es el único sitio que crea implementaciones concretas. Lecturas reactivas con `useLiveQuery(() => repo.list(), [repo])`.
- **Empaquetado (iteración 4)**: "todo o nada" (un toque guarda todas las unidades, otro las saca; a medias → completa). Al cambiar la cantidad se conserva lo guardado recortado a `num` (5/5 → 6 = 5/6; → 4 = 4/4). Progreso = artículos completos, no unidades. Orden fijo por orden de añadido (nada se mueve bajo el dedo). Añadir un artículo que ya está en la maleta → aviso, no suma. Quitar un artículo de la maleta → sin confirmación. Reglas puras en `features/luggage/domain/packing.ts`.
- **Catálogo implícito**: al añadir por nombre se reutiliza el artículo si existe (`findByName`: Collator 'es' base, iguala mayúsculas/tildes, distingue ñ) o se crea. Sin pantalla de catálogo por ahora.
- **Capa `application`** (`features/<f>/application/`): casos de uso que coordinan varios repositorios (p. ej. `addItemByName`). Solo conocen los ports.
- **Operaciones leer-calcular-escribir dentro del repositorio y en una transacción** (`togglePacked`, `resize`), no en la UI: evita *lost updates*.
- **Navegación**: el layout muestra "LugGAge" en el inicio y "‹ Mis maletas" en el resto de pantallas (convención iOS, imprescindible en la PWA instalada, que no tiene botón atrás). Navegación jerárquica: siempre al inicio, nunca `navigate(-1)`.
- **Tests de UI**: `renderApp(path, repositories)` (`src/test/render.tsx`) monta las rutas reales con `createMemoryRouter` y una base de datos aislada. jsdom no implementa `<dialog>.showModal()`: hay un stub en `src/test/setup.dom.ts`; dentro de un diálogo, buscar con `within(dialog)` (Testing Library no modela `inert`).

## 7. Principios

- **YAGNI**: backend, entidades de usuario y login se posponen hasta que hagan falta de verdad.
- **Single source of truth**: los valores derivados se calculan, no se guardan redundantes.
- **Offline-first**: todos los datos del MVP viven en IndexedDB; la sincronización se difiere.
- Sin backend no hay "usuario" real: un login local sería teatro. Como mucho, "perfiles locales" (opcional, solo si varias personas comparten navegador).
- Generar un **UUID local de dispositivo** desde el principio para facilitar el sync futuro.

## 8. Fase 2 (futuro, no implementar aún)

- Backend: FastAPI + Pydantic + SQLAlchemy + Alembic, con Postgres y Docker Compose.
- Autenticación (JWT, refresh tokens, OAuth) y sistema de usuarios.
- API de sincronización offline-first (resolución de conflictos por timestamps; valorar "última escritura gana" vs merge).
- Tests con `pytest`; despliegue del backend en Railway o Fly.io.

## 9. Pendiente de decidir (pregunta antes de asumir)

- Si habrá perfiles locales (¿una persona por dispositivo o dispositivo compartido?).
- Plataforma de despliegue final (Vercel vs Netlify).

## 10. Estado actual

- Fase: **iteración 5 (compartimentos)** en la rama `crud/compartments`. Decisiones: borrar compartimento → artículos a sueltos (SET NULL); sueltos arriba sin cabecera; "+" en cada compartimento para añadir dentro; plegado persistido con Zustand. Pasos: 1) datos ✅ (migración v2 con test, `CompartmentRepository`, `moveTo`, invariante, `addItemByName` con compartimento) · 2) UI (secciones plegables, "+" por compartimento, "Mover a…", crear/renombrar/borrar, texto de ayuda).
- Iteración 4 (artículos y empaquetado + navegación "‹ Mis maletas") mergeada en `develop`.
- Iteración 3 (maleta como entidad principal: crear en línea, detalle, `EditableTitle`, borrar) mergeada en `develop`.
- Iteración 2 (CRUD de viajes) mergeada en `develop` (PR #3); después se decidió eliminar los viajes. Se reutilizan sus piezas: router, DI por Context, `FormField`, `ConfirmDialog`, estilos y `renderApp`.
- **Riesgo conocido**: sin desplegar ni instalar como PWA, Safari de iOS puede borrar IndexedDB tras 7 días sin visitar la web. Usar solo datos de prueba hasta la iteración de PWA (el usuario decidió no adelantar el despliegue).
- Pendientes técnicos: el bundle supera 500 kB (157 kB gzip) → code splitting en la iteración de PWA; en el despliegue hará falta un rewrite de todas las rutas a `index.html`.
- Backlog: "Deshacer" al borrar (snapshot + reinserción + toast con Zustand), tests E2E con Playwright (casos que jsdom no reproduce: foco atrapado y Escape en `<dialog>`, blur al desmontar en `EditableTitle`).
- Pendiente de decidir (iteración 5): al borrar un compartimento, ¿sus ítems se borran o pasan a sueltos?
- Iteración 1 (capa de datos) mergeada en `develop` (PR #2).
- Setup (iteración 0) mergeado en `develop` (PR #1).
- Entorno instalado y verificado: Git 2.55.0, nvm-windows 2.0.1, Node.js 26.13.1 LTS y npm 11.20.0. Versión de Node registrada en `.nvmrc`.
- Identidad de Git configurada para este repositorio. Remoto `origin`: https://github.com/sgalans/LugGAge.git.
- Ramas: `main`, `develop` y una rama por iteración que sale de `develop`.
- ESLint y Prettier configurados. Comandos disponibles en `frontend/`: `dev`, `build`, `lint`, `format`, `format:check`, `preview`, `test` (watch), `test:run`, `typecheck` y **`check`** (typecheck + lint + formato + tests; ejecutarlo antes de cada commit y antes de dar un paso por terminado).
- TypeScript se mantiene en la línea 6.0 por compatibilidad con `typescript-eslint`; la plantilla original incluía TypeScript 7 y Oxlint.
- Roadmap del MVP (una rama/PR por iteración): 0) setup ✅ · 1) capa de datos ✅ · 2) CRUD de viajes ✅ (después eliminado) · 3) refactor: maleta como entidad principal · 4) ítems y empaquetado (añadir escribiendo con autocompletado del catálogo, cantidades, un toque = empaquetar, progreso) · 5) compartimentos (plegables, estado en Zustand) · 6) duplicar maleta · 7) PWA/offline · 8) CI y despliegue.
- `npm audit` detecta 9 avisos moderados procedentes de `minimatch`, dependencia transitiva de las herramientas de lint. Pendiente de actualización compatible; no se ha aplicado `audit fix --force`.
- Instalados: Dexie, Zod, uuid, Vitest, Testing Library y fake-indexeddb. Pendientes: PWA y Zustand. El MVP no necesita `venv` porque no incluye backend Python.
- Actualiza esta sección conforme avance el proyecto.
