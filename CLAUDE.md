# Equipao — contexto para agentes de código

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

**Nombre: "Equipao"** (decisión del usuario; sustituye a "LugGAge" y a "Cierra como puedas"). Es a la vez el nombre completo y el que se ve bajo el icono. El nombre visible vive solo en `APP_NAME` (`src/app/appInfo.ts`); los identificadores internos (BD `luggage-app`, claves de `localStorage`) NO se cambian nunca: renombrarlos = datos nuevos y vacíos.

App para preparar **maletas**: listas de equipaje donde se marca lo que ya está guardado. **Dispositivo principal: iPhone con Safari (y como PWA instalada en la pantalla de inicio).** Se diseña para el dedo y el teclado en pantalla de iOS, no para ratón ni teclado físico: zonas táctiles de 44 px o más, inputs de 16 px o más (si no, iOS hace zoom), botones visibles para toda acción (Enter es un atajo, no la única vía) y verificar en el iPhone real lo que dependa del teclado o del foco. Prioridad de producto: **lo más simple de usar posible, con el mínimo de clics** (crear en línea en vez de pantallas aparte, un toque para empaquetar…). Debe funcionar **offline** y ser accesible desde navegador (Chrome/Safari) e instalable en el móvil como **PWA**. Se valora mucho la sencillez y también velocidad de manejo de la interfaz y de la apliación para el usuario 

Se descartó React Native/Expo (dependería del ordenador sin pagar los 99 $/año de Apple Developer) y Flutter (fricción con iOS sin Mac).

## 4. Stack del MVP (decidido)

| Área | Decisión |
|---|---|
| Frontend | React + TypeScript + Vite |
| PWA | `vite-plugin-pwa` (service worker + manifest) |
| Almacenamiento local | Dexie.js sobre IndexedDB (offline-first) |
| Estado | Zustand |
| Despliegue | **Vercel** (decidido; deploy automático desde `main`, URL de prueba por PR) |
| Backend | **Ninguno en el MVP** |

### Herramientas y hábitos profesionales

- Node.js vía **nvm-windows** (versión en `.nvmrc`).
- Git + GitHub (cuenta personal, separada de la del trabajo). **Conventional Commits** (`feat:`, `fix:`, `chore:`…).
- ESLint + Prettier desde el principio; respeta su configuración al generar código.
- Flujo con PRs aunque trabaje solo (autorrevisión antes de mergear a `main`); `gh` CLI útil.
- CI con GitHub Actions (linter + tests en cada PR) — objetivo de aprendizaje.

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
- **Empaquetado (iteración 4)**: "todo o nada" (un toque guarda todas las unidades, otro las saca; a medias → completa). Al cambiar la cantidad se conserva lo guardado recortado a `num` (5/5 → 6 = 5/6; → 4 = 4/4). Progreso = artículos completos, no unidades. **Orden**: SIEMPRE el del usuario (hoy el de añadido; con arrastre, el manual): **nada cambia de sitio nunca** y la página es lo más estática posible (definición del usuario). **Listo es un dato del artículo; lo demás es vista.** (1) **Ventana "Listos"** (`ReadyListDialog.tsx`): se abre **tocando la barra de progreso** ("5 de 9 listos ›"), como hoja inferior **encima** de la página (no desplaza nada); título "Listos" sin recuento (la única cifra es la de la barra, que cuenta bloques); lista TODOS los artículos listos, sueltos y por compartimento (cabeceras en mayúsculas, sin círculo; un compartimento listo lleva un **✓ verde tras el nombre**, no tocable, con ", listo" para VoiceOver, y sale aunque no tenga artículos listos), estén ocultos o no; se pueden desmarcar desde ahí (la lista de la ventana es una foto al abrirla: lo desmarcado se queda hasta cerrar). (2) **Ojo "Ocultar listos"** en la barra justo encima de la lista, junto a "Seleccionar": **solo icono** (`PackedVisibilityIcon`: ojo + ✓; muestra el ESTADO: abierto = se ven, tachado = ocultos; nombre fijo + `aria-pressed`). Oculta los artículos listos de la lista **sin mover nada**; oculta cada **artículo** listo, y un **compartimento entero solo si está COMPLETO** (marcado como listo **y** con todos sus artículos listos; uno vacío y marcado también); si no, se queda su cabecera y solo oculta sus artículos listos (si todo su contenido está oculto: "Todo listo (oculto)."). Sin nada hecho, no hay ojo. Se oculta según una FOTO de lo hecho (ids de líneas listas y de compartimentos completos, en un mismo conjunto) al tocar el ojo (`packingOrderStore.ts`, Zustand con `persist`, clave `luggage-app:hidden-packed-v2`; se borra al borrar la maleta): lo que se marque o complete después **se queda a la vista** y el ojo vuelve a abierto; lo que se desmarca reaparece al momento. Probado y descartado por el usuario (no volver a proponerlo): animaciones (ninguna), pausa de 1 s, mover al instante al marcar (desaparece de debajo del dedo), mover lo listo a una sección ("Guardados"/"Listos ocultos") al final o bajo el progreso, sección plegable que desplaza la página, interruptor activado/desactivado y punto de aviso, "Solo lo que falta" (ocultaba lo guardado) y reordenar al volver a entrar (cambiaba la lista sin que se viera). Reglas puras en `features/luggage/domain/packing.ts`.
- **Datos por defecto**: catálogo (~85 artículos) y "Maleta básica" (12 sueltos + compartimento "Neceser" con 10, descripción "Plantilla base: duplícala (⧉) para cada viaje."), contenido acordado con el usuario. Excluidos a propósito por personales/ambiguos: Decant, Cepillo de la funda, Fundas, Cajita, Regla.
- **Catálogo implícito**: al añadir por nombre se reutiliza el artículo si existe (`findByName`: Collator 'es' base, iguala mayúsculas/tildes, distingue ñ) o se crea. Además hay pantalla de catálogo (`/items`: buscar o crear, renombrar, borrar).
- **Capa `application`** (`features/<f>/application/`): casos de uso que coordinan varios repositorios (p. ej. `addItemByName`). Solo conocen los ports.
- **Operaciones leer-calcular-escribir dentro del repositorio y en una transacción** (`togglePacked`, `resize`), no en la UI: evita *lost updates*.
- **Acciones de la maleta**: duplicar = botón ⧉ en cada fila del listado (al lado de la tarjeta-enlace, nunca dentro: no se anidan elementos interactivos); tras duplicar se queda en el listado y la copia sale la primera, resaltada. Borrar = botón rojo con texto al final del detalle de la maleta.
- **Errores en la UI**: fallos al pintar → `RouteErrorPage` (error boundary del router; `useLiveQuery` propaga los errores de lectura). Fallos al guardar sin contexto propio → `reportError(error)`, que registra y muestra el aviso global "No se ha podido guardar". Si el fallo tiene un sitio natural (un formulario, un diálogo), mensaje junto a él. Nunca un `console.error` a secas en la UI. La región del aviso usa `aria-live` (no `role="alert"`), para no chocar con los alerts de los formularios.
- **Navegación**: el layout muestra el nombre de la app (`APP_NAME` en `src/app/appInfo.ts`) en el inicio y un "‹" de volver en el resto de pantallas (convención iOS, imprescindible en la PWA instalada, que no tiene botón atrás). Navegación jerárquica, nunca `navigate(-1)`: por defecto "‹ Mis maletas" (al inicio); una ruta puede declarar otro nivel superior en su `handle` (`RouteHandle.back` en `src/app/navigation.ts`), p. ej. "‹ Maleta" desde "Añadir varios".
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
- Las necesidades que suele cubrir un backend (copia de seguridad, cambiar de móvil, compartir una maleta) se resuelven sin servidor: compartir/importar maletas como texto (backlog).
- Si algún día se retoma: FastAPI + Pydantic + SQLAlchemy + Alembic, Postgres y Docker Compose; sincronización offline-first por timestamps.

## 9. Pendiente de decidir (pregunta antes de asumir)

- Si habrá perfiles locales (¿una persona por dispositivo o dispositivo compartido?).

## 10. Estado actual

- **Producción: v1.0.0** en `https://equipao.vercel.app` (rama `main`, *tag* `v1.0.0`), instalada como PWA en el iPhone. En curso el **hotfix v1.0.1** (rama `fix/offline-precache`): el manifest salía dos veces en la precaché, Workbox lanzaba `add-to-cache-list-conflicting-entries` y el service worker no se instalaba (sin modo sin conexión). Arreglo: sin `webmanifest` en `globPatterns` (`vite.config.ts`).
- **PWA** (iteración 10): `vite-plugin-pwa` con `registerType: 'prompt'` (manifest, precaché y `navigateFallback`); icono `public/icon.svg` → `@vite-pwa/assets-generator`; ajustes de iOS (safe areas, barra de estado `default`, `theme-color` claro/oscuro); `requestPersistentStorage()`; avisos de actualización (`AppUpdates`/`UpdateBanner`); chunk `vendor` + rutas secundarias con `lazy`.
- **Vercel**: Root Directory `frontend`, producción = `main`, Node 26.x, vistas previas por PR protegidas (Deployment Protection). `frontend/vercel.json`: rewrite a `index.html` y sin caché para `sw.js`/`index.html`/manifest.
- **Datos**: viven solo en cada dispositivo. En iOS, la app instalada y Safari NO comparten datos. Con la PWA instalada + almacenamiento persistente no aplica la limpieza de 7 días de Safari; la red de seguridad pendiente es compartir/importar como texto (backlog).
- **Flujo de Git**: `main` (producción) y `develop` (**rama por defecto en GitHub**: las PRs van a `develop` por defecto); una rama por grupo de tareas relacionadas que sale de `develop` (una migración o algo arriesgado, en su propia rama) → PR a `develop` (auto-merge activado: `gh pr merge --auto --merge --delete-branch`) → PR de *release* `develop` → `main` (Vercel publica `main`) → *tag* `vX.Y.Z` (versionado semántico). Probar antes en la vista previa de la PR. Remoto: https://github.com/sgalans/Equipao.

### Backlog (priorizado; decidir alcance con el usuario antes de empezar cada punto)

El backlog vive **aquí** (decisión del usuario: GitHub Issues/Projects se probó y se descartó por incómodo para un proyecto de una persona). Para añadir, quitar o repriorizar: editar esta lista. Al terminar un punto, quitarlo de aquí y anotarlo en el historial.

**En curso: rama `feature/packing`** (una rama por grupo de tareas relacionadas, no por tarea)
- ~~"Solo lo que falta"~~ → sustituido por el interruptor **"Guardados al final"** (hecho; ver Decisiones cerradas → Empaquetado). Pendiente: probarlo en el iPhone.
- **Artículos de "último momento"** (cepillo de dientes, cargador, gafas: no se pueden guardar hasta el día de salida): marcarlos en la maleta y recordatorio al final "Antes de salir: N cosas".
- **"Por comprar"**: marcar un artículo que aún no se tiene (protector solar, adaptador) y ver la lista de la compra de esa maleta.
- Los dos últimos = campos nuevos en `ItemQuantity` en **una sola migración (v4)**, con su test.
- Posible extra: aviso las 1-2 primeras veces que se toca "Ocultar listos" (p. ej. "Listos ocultos. Tócalos en la barra de progreso para verlos."), con el sistema de avisos existente, para enseñar que es un interruptor. (Descartado de momento: consejo *just-in-time* único y tutoriales.)

**Prioridad alta**
1. **Compartir e importar maletas como texto** (petición del usuario; sustituye a exportar/importar JSON): compartir con la hoja nativa de iOS (`navigator.share({ text })` → WhatsApp, Notas, AirDrop; si no hay `share`, copiar al portapapeles) en un formato legible y parseable (`# Maleta`, `## Compartimento`, `- 2 × Calcetines`). Importar = pegar el texto → parser puro en `domain` (con tests) que crea la maleta como copia nueva, reutilizando artículos del catálogo por nombre (`isSameItemName`, `addItemByName`); tolerante con listas sin formato (una línea = un artículo). Limitación asumida: no guarda lo ya guardado ni los artículos del catálogo sin usar; para cambiar de móvil, "Compartir todo".
2. **Ordenar artículos arrastrando** (petición del usuario): el arrastre define el orden del usuario (sustituye al de añadido). dnd-kit, asa ≡ en cada fila, campo `position` + **migración** y *fractional indexing*; mantener "Mover a…"/selección como alternativa accesible (WCAG 2.2 SC 2.5.7); probar el gesto con Playwright. En su propia rama (arriesgado).

**Prioridad media**
3. **Test de humo del build en el CI** (tras el fallo sin conexión de v1.0.0): tras `npm run build`, comprobar que `dist/sw.js` no tiene URLs duplicadas en la precaché e incluye `index.html` y el `NavigationRoute`.
4. **"Reiniciar maleta"**: desmarcar todo (artículos a 0 guardados, compartimentos sin "listo") para reutilizarla tras el viaje.
5. **Organizar maletas: archivo o carpetas** (petición del usuario: carpeta "Viajes hechos"). **A decidir**: (A, recomendado, YAGNI) `Luggage.archivedAt` + migración, acción "Archivar" y sección plegable "Viajes hechos (N)"; o (B) entidad `Folder` + `Luggage.folderId` (SET NULL al borrar), un nivel, con gestión de carpetas y "Mover a…". A es un caso particular de B (migrable sin perder nada). Al archivar, ofrecer "Reiniciar maleta".
6. **Familias de artículos** (petición del usuario): `Category` (id, name, orden) + `Item.categoryId` opcional (SET NULL) + migración; familias por defecto desde los grupos de `defaultData.ts`; catálogo en secciones plegables. A decidir si se ven dentro de la maleta (compartimento = DÓNDE va; familia = QUÉ ES).
7. **Fecha del viaje (opcional)**: revisar "sin fechas en la maleta" si se quiere ordenar por fecha, archivar solo o cuenta atrás. Valorarlo con el punto 5. `'YYYY-MM-DD'`.
8. **Recordatorio de olvidos típicos**: aviso si falta "DNI / Pasaporte" o "Cargador del móvil".
9. **"Deshacer" al borrar** (snapshot + reinserción + aviso con botón): sustituiría a algunas confirmaciones.
10. **Tests E2E con Playwright**: foco y Escape en `<dialog>`, blur en `InlineEditInput`, gestos táctiles, service worker y modo sin conexión.
11. **Dependabot o Renovate** (con el CI comprobando las PRs).
12. **Monitorización de errores** (p. ej. Sentry gratuito) en `reportError` y `RouteErrorPage`, sin enviar nombres de maletas ni de artículos.
13. **Changelog y versiones automáticas** (release-please o changesets) a partir de los Conventional Commits.

**Prioridad baja / mejoras técnicas**
14. **Celebración al completar una maleta** ("¡Cerrada!"), respetando "Reducir movimiento".
15. **Buscar dentro de una maleta**.
16. **`zod/mini`** para adelgazar `vendor` (Zod ≈ 19 %; exige reescribir los esquemas).
17. **Mantenimiento de herramientas**: `overrides` de `eslint-plugin-jsx-a11y` (ESLint 10), avisos de `npm audit` (9 de `minimatch`; el CI ya muestra 12: revisar), npm 12.
18. **Auditoría de accesibilidad** con VoiceOver y Lighthouse.
19. **Ideas aparcadas**: maleta plantilla adicional, "copiar compartimento desde otra maleta", perfiles locales.
20. **Mantener la pantalla encendida mientras se empaqueta** (Screen Wake Lock API). Lo último (decisión del usuario).

### Entorno y herramientas

- Git 2.55, nvm-windows 2.0.1, Node.js 26 LTS (`.nvmrc`), npm 11. GitHub CLI (`gh`) para PRs y el CI.
- Comandos en `frontend/`: `dev`, `build`, `lint`, `format`, `format:check`, `preview`, `test` (watch), `test:run`, `typecheck` y **`check`** (typecheck + lint + formato + tests; ejecutarlo antes de cada commit y antes de dar un paso por terminado).
- **CI** (GitHub Actions, `.github/workflows/ci.yml`): un único job `check` (`npm ci` + `npm run check` + `npm run build`, Node desde `.nvmrc`) en cada PR a `develop`/`main` y en cada push a ellas; caché de `node_modules` con clave SO + `.nvmrc` + lockfile (sin caché, `npm ci` era ~37 de ~72 s; los tests, 8 s). **Ruleset "Proteger main y develop"**: exige PR (0 aprobaciones) y el check `check` en verde, sin *force push* ni borrado. Si se renombra el job, actualizar el ruleset.
- TypeScript en la línea 6.0 por compatibilidad con `typescript-eslint`.
- `npm audit`: 9 avisos moderados de `minimatch` solo en herramientas de lint (`npm audit --omit=dev` = 0). No aplicar `npm audit fix --force` (degradaría las herramientas); revisar cuando ESLint actualice.
- Historial (una rama/PR por iteración): 0) setup · 1) capa de datos · 2) viajes (después eliminados) · 3) maleta como entidad principal · 4) artículos y empaquetado · 5) compartimentos · 6) duplicar maleta · 7) catálogo · 8) revisión general · 9) crear desde el catálogo, añadir varios, datos por defecto · 10) PWA y despliegue → **v1.0.0** · 11) CI con GitHub Actions (+ ruleset y caché).
- Actualiza esta sección conforme avance el proyecto.
