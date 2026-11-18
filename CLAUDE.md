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

App para crear **listas de equipaje/maleta para viajes**. Debe funcionar **offline** y ser accesible desde navegador (Chrome/Safari) e instalable en el móvil como **PWA**.

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

- `Trip`: id (uuid), name, startDate, endDate, createdAt, updatedAt
- `Luggage`: id (uuid), tripId → Trip, name, createdAt, updatedAt
- `Item`: id (uuid), name, color, createdAt, updatedAt
- `ItemQuantity` (tabla intermedia / junction table): id (uuid), luggageId → Luggage, itemId → Item, num, nAlreadyPacked, createdAt, updatedAt

## 6. Decisiones cerradas

- **UUID como clave primaria en todo** (habilita sincronización futura sin coordinación de servidor).
- `ItemQuantity` como junction table que guarda las claves foráneas.
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
- **Fechas**: `startDate`/`endDate` como `'YYYY-MM-DD'`; `createdAt`/`updatedAt` como ISO 8601 UTC (`toISOString()`).
- **Repositorios: ports & adapters.** La interfaz (`XRepository`) vive en `features/<f>/domain/` y la implementación (`createDexieXRepository(db)`, patrón factory + inyección de dependencias) en `features/<f>/data/`. Los repositorios validan con Zod, rellenan id/timestamps y traducen errores técnicos a errores de dominio (`src/shared/domain/errors.ts`).
- **Integridad referencial** (en Architecture.md): borrar Trip → CASCADE (maletas y su contenido); borrar Luggage → CASCADE (su contenido); borrar Item en uso → RESTRICT (`InUseError`); `UNIQUE (luggageId, itemId)` → `DuplicateError`. Al crear se comprueba que las FK existen (`EntityNotFoundError`). Los borrados son idempotentes.
- **Nombres de errores propios**: nunca coinciden con los de DOMException/IndexedDB (p. ej. `NotFoundError`), porque Dexie los convierte en sus propios errores al salir de una transacción.
- **UI (iteración 2)**: React Router (rutas en `src/app/routes.ts`, layout `AppLayout`), React Hook Form + `zodResolver` con los esquemas Zod existentes, CSS Modules (`X.module.css` junto al componente) y variables CSS globales en `index.css`.
- **Inyección de repositorios en la UI con React Context**: `RepositoriesContext` y `useRepositories()` en `src/shared/di/` (solo conocen las interfaces); la composition root (`src/app/compositionRoot.ts`) es el único sitio que crea implementaciones concretas. Lecturas reactivas con `useLiveQuery(() => repo.list(), [repo])`.
- **Tests de UI**: `renderApp(path, repositories)` (`src/test/render.tsx`) monta las rutas reales con `createMemoryRouter` y una base de datos aislada.

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

- Fase: **iteración 2 (CRUD de viajes)** en la rama `feature/crud-trip`. Pasos: 1) infraestructura + lista de viajes ✅ · 2) crear · 3) editar · 4) borrar con confirmación. El bundle supera 500 kB (157 kB gzip): revisar con code splitting en la iteración 6.
- Iteración 1 (capa de datos) mergeada en `develop` (PR #2).
- Setup (iteración 0) mergeado en `develop` (PR #1).
- Entorno instalado y verificado: Git 2.55.0, nvm-windows 2.0.1, Node.js 26.13.1 LTS y npm 11.20.0. Versión de Node registrada en `.nvmrc`.
- Identidad de Git configurada para este repositorio. Remoto `origin`: https://github.com/sgalans/LugGAge.git.
- Ramas: `main`, `develop` y una rama por iteración que sale de `develop`.
- ESLint y Prettier configurados. Comandos disponibles en `frontend/`: `dev`, `build`, `lint`, `format`, `format:check`, `preview`, `test` (watch), `test:run` y `typecheck`.
- TypeScript se mantiene en la línea 6.0 por compatibilidad con `typescript-eslint`; la plantilla original incluía TypeScript 7 y Oxlint.
- Roadmap del MVP (una rama/PR por iteración): 0) cerrar setup · 1) capa de datos (tipos, Dexie, UUID de dispositivo, tests) · 2) CRUD de viajes · 3) maletas · 4) ítems y cantidades · 5) duplicar maleta · 6) PWA/offline · 7) CI y despliegue.
- `npm audit` detecta 9 avisos moderados procedentes de `minimatch`, dependencia transitiva de las herramientas de lint. Pendiente de actualización compatible; no se ha aplicado `audit fix --force`.
- Instalados: Dexie, Zod, uuid, Vitest, Testing Library y fake-indexeddb. Pendientes: PWA y Zustand. El MVP no necesita `venv` porque no incluye backend Python.
- Actualiza esta sección conforme avance el proyecto.
