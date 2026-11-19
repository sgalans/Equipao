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

- `Luggage` (maleta, entidad principal): id (uuid), name, description (`''` = sin descripción, máx. 500, varias líneas), createdAt, updatedAt
- `Compartment` (compartimento): id (uuid), luggageId → Luggage, name, isReady ("listo" propio), createdAt, updatedAt. Un solo nivel (no se anidan).
- `Item` (catálogo global): id (uuid), name, createdAt, updatedAt
- `ItemQuantity` (junction table): id (uuid), luggageId → Luggage, compartmentId → Compartment (`null` explícito = suelto), itemId → Item, num, nAlreadyPacked, createdAt, updatedAt
- **Eliminados**: `Trip` (tras la iteración 2: añadía navegación sin aportar al caso de uso) y `Item.color` (YAGNI). Sin fechas en la maleta por ahora.

### Vocabulario de la interfaz (lenguaje ubicuo)

- **Maleta** = `Luggage`. **Compartimento** = `Compartment`. Texto de ayuda acordado: *"Contenedor para meter artículos, como un neceser, una mochila o un maletín."*
- `Item` en la interfaz: **"artículo"** (confirmado; descartados "ítem", "objeto", "cosa" y "elemento"). Además, preferir microcopy que no necesite el sustantivo ("Añadir a la maleta…", "3 de 12 guardados").

## 6. Decisiones cerradas

- **UUID como clave primaria en todo** (habilita sincronización futura sin coordinación de servidor).
- `ItemQuantity` como junction table que guarda las claves foráneas. Un ítem ocupa **un solo sitio por maleta** (`UNIQUE (luggageId, itemId)`): en un compartimento o suelto.
- Restricción `CHECK (nAlreadyPacked <= num)`.
- **No existe** un booleano `everythingPacked`: se **deriva en código**.
- `createdAt`/`updatedAt` en todas las tablas (barato ahora, útil para resolver conflictos después).
- Duplicar una maleta = **clonar filas** (Opción A), elegido sobre herencia por plantilla/delta por simplicidad del MVP. Implementado en `luggages.duplicate(id)` (la maleta es la raíz del agregado: maleta + compartimentos + cantidades se copian en una transacción, con un mapa de ids de compartimento). La copia se llama "Nombre (copia)" / "(copia 2)"… (`copyName.ts`), empieza **sin nada guardado** y reutiliza los artículos del catálogo.
- **Arquitectura del frontend: por features + repositorios.** `src/app/` (App, router, providers), `src/features/<feature>/{domain,data,ui}` y `src/shared/{db,lib,ui}`. La UI nunca habla con Dexie directamente: lo hace a través de repositorios (repository pattern), para poder cambiar a una API en la fase 2.
- **Las restricciones del modelo (CHECK, FK) se validan en código** en la capa `domain`, porque IndexedDB no las impone.
- **Fuente de verdad de los datos: Dexie** (`useLiveQuery`). Zustand se usa solo para estado de UI, no para duplicar datos de dominio.
- **Testing: Vitest + Testing Library**, con `fake-indexeddb` para probar la capa de datos. Vitest no comprueba tipos: ejecutar también `npm run typecheck`. Dos proyectos de Vitest: `*.test.ts` corre en `node` (rápido) y `*.test.tsx` en `jsdom` (componentes).
- **Validación con Zod**: el esquema es la fuente de verdad y los tipos se infieren con `z.infer`. Cada entidad tiene `XSchema` (persistida) y `NewXSchema` (input sin id ni timestamps).
- **IDs: UUID v7** con la librería `uuid` (ordenables y sin depender de `crypto.randomUUID`, que solo existe en HTTPS/localhost).
- **Timestamps**: `createdAt`/`updatedAt` como ISO 8601 UTC (`toISOString()`). Si en el futuro hay fechas de calendario, guardarlas como `'YYYY-MM-DD'` y formatear en UTC (evita el bug de zona horaria).
- **Repositorios: ports & adapters.** La interfaz (`XRepository`) vive en `features/<f>/domain/` y la implementación (`createDexieXRepository(db)`, patrón factory + inyección de dependencias) en `features/<f>/data/`. Los repositorios validan con Zod, rellenan id/timestamps y traducen errores técnicos a errores de dominio (`src/shared/domain/errors.ts`).
- **Integridad referencial** (en Architecture.md): borrar Luggage → CASCADE (su contenido y sus compartimentos); borrar Compartment → SET NULL (sus artículos pasan a sueltos); invariante "el compartimento es de la misma maleta" → `ConsistencyError`; borrar Item → CASCADE (se quita de todas las maletas; la UI avisa de en cuáles está; antes era RESTRICT); crear o renombrar Item con el nombre de otro → `DuplicateError` (lo comprueba el repositorio, dentro de la transacción); `UNIQUE (luggageId, itemId)` → `DuplicateError`. Al crear se comprueba que las FK existen (`EntityNotFoundError`). Los borrados son idempotentes.
- **Migraciones de Dexie**: la `version(1)` está congelada (hay datos reales en navegadores). Cada cambio de esquema = nueva versión (`SCHEMA_Vn` exportado en `src/shared/db/db.ts`) con `upgrade()` si hay que transformar datos, y un test que crea una BD con la versión anterior, la migra y comprueba el resultado (`db.migration.test.ts`). v2 = compartimentos; v3 = `Luggage.description` + `Compartment.isReady` (sin cambios de índices, solo `upgrade()`).
- **Nombres de errores propios**: nunca coinciden con los de DOMException/IndexedDB (p. ej. `NotFoundError`), porque Dexie los convierte en sus propios errores al salir de una transacción.
- **UI**: React Router (rutas en `src/app/routes.ts`, layout `AppLayout`), formularios de un campo con `useState` + `InlineEditInput` (React Hook Form se usó con los viajes y se desinstaló al quedar sin uso; volver a valorarlo si aparece un formulario de varios campos), CSS Modules (`X.module.css` junto al componente) y variables CSS globales en `index.css`.
- **Inyección de repositorios en la UI con React Context**: `RepositoriesContext` y `useRepositories()` en `src/shared/di/` (solo conocen las interfaces); la composition root (`src/app/compositionRoot.ts`) es el único sitio que crea implementaciones concretas. Lecturas reactivas con `useLiveQuery(() => repo.list(), [repo])`.
- **Empaquetado (iteración 4)**: "todo o nada" (un toque guarda todas las unidades, otro las saca; a medias → completa). Al cambiar la cantidad se conserva lo guardado recortado a `num` (5/5 → 6 = 5/6; → 4 = 4/4). Progreso = artículos completos, no unidades. Orden fijo por orden de añadido (nada se mueve bajo el dedo). Añadir un artículo que ya está en la maleta → aviso, no suma. Quitar un artículo de la maleta → sin confirmación. Reglas puras en `features/luggage/domain/packing.ts`.
- **Catálogo implícito**: al añadir por nombre se reutiliza el artículo si existe (`findByName`: Collator 'es' base, iguala mayúsculas/tildes, distingue ñ) o se crea. Sin pantalla de catálogo por ahora.
- **Capa `application`** (`features/<f>/application/`): casos de uso que coordinan varios repositorios (p. ej. `addItemByName`). Solo conocen los ports.
- **Operaciones leer-calcular-escribir dentro del repositorio y en una transacción** (`togglePacked`, `resize`), no en la UI: evita *lost updates*.
- **Acciones de la maleta**: duplicar = botón ⧉ en cada fila del listado (al lado de la tarjeta-enlace, nunca dentro: no se anidan elementos interactivos); tras duplicar se queda en el listado y la copia sale la primera, resaltada. Borrar = botón rojo con texto al final del detalle de la maleta.
- **Errores en la UI**: fallos al pintar → `RouteErrorPage` (error boundary del router; `useLiveQuery` propaga los errores de lectura). Fallos al guardar sin contexto propio → `reportError(error)`, que registra y muestra el aviso global "No se ha podido guardar". Si el fallo tiene un sitio natural (un formulario, un diálogo), mensaje junto a él. Nunca un `console.error` a secas en la UI. La región del aviso usa `aria-live` (no `role="alert"`), para no chocar con los alerts de los formularios.
- **Navegación**: el layout muestra "LugGAge" en el inicio y un "‹" de volver en el resto de pantallas (convención iOS, imprescindible en la PWA instalada, que no tiene botón atrás). Navegación jerárquica, nunca `navigate(-1)`: por defecto "‹ Mis maletas" (al inicio); una ruta puede declarar otro nivel superior en su `handle` (`RouteHandle.back` en `src/app/navigation.ts`), p. ej. "‹ Maleta" desde "Añadir varios".
- **Tests de UI**: `renderApp(path, repositories)` (`src/test/render.tsx`) monta las rutas reales con `createMemoryRouter` y una base de datos aislada. jsdom no implementa `<dialog>.showModal()`: hay un stub en `src/test/setup.dom.ts`; dentro de un diálogo, buscar con `within(dialog)` (Testing Library no modela `inert`).

## 7. Principios

- **YAGNI**: backend, entidades de usuario y login se posponen hasta que hagan falta de verdad.
- **Single source of truth**: los valores derivados se calculan, no se guardan redundantes.
- **Offline-first**: todos los datos del MVP viven en IndexedDB; la sincronización se difiere.
- Sin backend no hay "usuario" real (y no se quiere: ver sección 8): un login local sería teatro. Como mucho, "perfiles locales" (opcional, solo si varias personas comparten navegador).
- Hay un **UUID local de dispositivo** (`getDeviceId`) por si algún día hay sincronización; no se usa todavía.

## 8. Backend: descartado por ahora (decisión del usuario)

- **No habrá backend ni usuarios mientras el usuario no lo decida.** Motivo de producto: un backend centralizado obliga a tener cuentas para separar los datos de cada persona, y el login añade pasos que chocan con la prioridad "lo más simple de usar posible".
- La arquitectura deja la puerta abierta sin coste: repositorios (ports & adapters), UUID v7, `createdAt`/`updatedAt` y `deviceId`. No construir nada "por si acaso" para el backend (YAGNI).
- Las necesidades que suele cubrir un backend (copia de seguridad, cambiar de móvil, compartir una maleta) se resuelven sin servidor, p. ej. exportar/importar un archivo.
- Si algún día se retoma: FastAPI + Pydantic + SQLAlchemy + Alembic, Postgres y Docker Compose; sincronización offline-first por timestamps.

## 9. Pendiente de decidir (pregunta antes de asumir)

- Si habrá perfiles locales (¿una persona por dispositivo o dispositivo compartido?).
- Plataforma de despliegue final (Vercel vs Netlify).

## 10. Estado actual

- Fase: **iteración 9 (crear artículos desde el catálogo + añadir varios de golpe) terminada** en la rama `feature/improve-catalog`, pendiente de PR a `develop`: `items.create` sin duplicados, `quantities.addMany` idempotente, campo único "Buscar o crear" (solo "+" crea), modo selección en el catálogo + `AddItemsDialog`, y pantalla "Añadir varios del catálogo" desde la maleta (`/luggages/:luggageId/add-items`; sin compartimentos añade directamente). 222 tests. El acceso "Añadir más artículos del catálogo" es un icono (lista con "+") junto al "+" del campo principal de la maleta (`AddItemForm.catalogLink`). Antes del despliegue, en esta misma rama: **artículos por defecto y maleta por defecto** (a detallar con el usuario). Siguiente: iteración 10 (PWA y despliegue).
- Iteración 8 (revisión general + ajustes) mergeada en `develop`.
- Iteración 7 (catálogo de artículos) mergeada en `develop`.
- Iteración 6 (duplicar maleta) mergeada en `develop`.
- Iteración 5 (compartimentos) mergeada en `develop`.
- Iteración 4 (artículos y empaquetado + navegación "‹ Mis maletas") mergeada en `develop`.
- Iteración 3 (maleta como entidad principal: crear en línea, detalle, `EditableTitle`, borrar) mergeada en `develop`.
- Iteración 2 (CRUD de viajes) mergeada en `develop` (PR #3); después se decidió eliminar los viajes. Se reutilizan sus piezas: router, DI por Context, `FormField`, `ConfirmDialog`, estilos y `renderApp`.
- **Riesgo conocido**: sin desplegar ni instalar como PWA, Safari de iOS puede borrar IndexedDB tras 7 días sin visitar la web. Usar solo datos de prueba hasta la iteración de PWA (el usuario decidió no adelantar el despliegue).
- Pendientes técnicos: el bundle supera 500 kB (157 kB gzip) → code splitting en la iteración de PWA; en el despliegue hará falta un rewrite de todas las rutas a `index.html`.
- Backlog: **Arrastrar artículos para ordenar y moverlos entre compartimentos** (idea del usuario, aplazada; si se hace: dnd-kit, asa de arrastre ≡ en cada fila, orden manual con campo `position` + migración v3 y *fractional indexing*, mantener "Mover a…" como alternativa accesible por WCAG 2.2 SC 2.5.7, y probar el gesto con Playwright). "Deshacer" al borrar (snapshot + reinserción + toast con Zustand), tests E2E con Playwright (casos que jsdom no reproduce: foco atrapado y Escape en `<dialog>`, blur al desmontar en `EditableTitle`).
- Iteración 1 (capa de datos) mergeada en `develop` (PR #2).
- Setup (iteración 0) mergeado en `develop` (PR #1).
- Entorno instalado y verificado: Git 2.55.0, nvm-windows 2.0.1, Node.js 26.13.1 LTS y npm 11.20.0. Versión de Node registrada en `.nvmrc`.
- Identidad de Git configurada para este repositorio. Remoto `origin`: https://github.com/sgalans/LugGAge.git.
- Ramas: `main`, `develop` y una rama por iteración que sale de `develop`.
- ESLint y Prettier configurados. Comandos disponibles en `frontend/`: `dev`, `build`, `lint`, `format`, `format:check`, `preview`, `test` (watch), `test:run`, `typecheck` y **`check`** (typecheck + lint + formato + tests; ejecutarlo antes de cada commit y antes de dar un paso por terminado).
- TypeScript se mantiene en la línea 6.0 por compatibilidad con `typescript-eslint`; la plantilla original incluía TypeScript 7 y Oxlint.
- Roadmap del MVP (una rama/PR por iteración): 0) setup ✅ · 1) capa de datos ✅ · 2) CRUD de viajes ✅ (después eliminado) · 3) maleta como entidad principal ✅ · 4) artículos y empaquetado ✅ · 5) compartimentos ✅ · 6) duplicar maleta · 7) **catálogo de artículos**: pantalla con todos los artículos para renombrarlos y borrarlos (decidir qué pasa al borrar uno que está en alguna maleta; hoy el repositorio aplica RESTRICT) · 8) **revisión general + pequeños ajustes** antes de publicar. Ajustes pedidos: (a) las acciones "Renombrar" y "Borrar compartimento" no deben verse siempre (los compartimentos suelen estar desplegados); (b) los compartimentos deben poder marcarse como "listos" con un botón (a decidir: atajo que guarda todos sus artículos —estado derivado, single source of truth— frente a un estado propio) · 9) PWA/offline + despliegue · 9) **crear artículos desde el catálogo + añadir varios de golpe a una maleta** (decidido: campo "Nuevo artículo…" arriba del catálogo, con aviso si ya existe; añadir varios desde el catálogo —"Seleccionar" → elegir maleta— y desde la maleta —"Añadir varios"—, eligiendo destino suelto o compartimento; los que ya están en la maleta se ignoran, sin sumar cantidad; sin migración) · 10) **PWA/offline + despliegue** (manifest, service worker, ajustes iOS, almacenamiento persistente, aviso de nueva versión, code splitting, Vercel o Netlify) · después: maleta plantilla por defecto y "copiar compartimento desde otra maleta" (resto de la idea de reutilizar grupos) · 11) exportar/importar copia (backup, cambiar de móvil, compartir una maleta) · 12) CI con GitHub Actions.
- `npm audit` detecta 9 avisos moderados de `minimatch` (ReDoS), solo en herramientas de lint: `npm audit --omit=dev` = 0. `npm audit fix` no los resuelve (ESLint fija minimatch 10; el arreglo está en la 11) y `--force` degradaría las herramientas: no aplicar. Revisar cuando ESLint actualice.
- Instalados: Dexie, Zod, uuid, Zustand, React Router, Vitest, Testing Library y fake-indexeddb. Pendiente: `vite-plugin-pwa`. El MVP no necesita `venv` porque no incluye backend Python.
- Actualiza esta sección conforme avance el proyecto.
