# LugGAge

App para preparar maletas: listas de equipaje donde se marca lo que ya está guardado. Pensada para el iPhone (se instala como PWA desde Safari) y para funcionar **sin conexión**: todos los datos viven en el propio dispositivo.

## Funcionalidades

- **Maletas**: crear en línea (escribir + Intro), renombrar tocando el título, descripción opcional con notas, duplicar (la copia empieza sin nada guardado, útil como plantilla) y borrar.
- **Artículos**: añadir escribiendo, con sugerencias del catálogo; cantidades; un toque en el círculo guarda o saca el artículo; progreso por maleta ("3 de 5 listos").
- **Compartimentos**: subgrupos dentro de la maleta (neceser, mochila…), plegables, con su propio progreso y su marca de "listo"; mover artículos entre ellos. En el progreso de la maleta, cada compartimento cuenta como un bloque.
- **Catálogo de artículos**: listado con buscador para renombrar o borrar artículos (borrar uno lo quita de las maletas, con aviso previo).

## Stack

| Área         | Tecnología                                   |
| ------------ | -------------------------------------------- |
| UI           | React 19 + TypeScript + Vite, CSS Modules    |
| Rutas        | React Router                                 |
| Datos        | Dexie.js sobre IndexedDB (offline-first)     |
| Validación   | Zod (los tipos se infieren de los esquemas)  |
| Estado de UI | Zustand (p. ej. compartimentos plegados)     |
| Tests        | Vitest + Testing Library + fake-indexeddb    |
| Calidad      | ESLint + Prettier, Conventional Commits, PRs |

## Arquitectura

```
frontend/src/
  app/          composition root, router, layout
  features/
    luggage/    maletas, compartimentos y su contenido
    items/      catálogo de artículos
      domain/       entidades (Zod), reglas puras y PORTS (interfaces de repositorio)
      application/  casos de uso que coordinan varios repositorios
      data/         ADAPTERS: implementaciones con Dexie
      ui/           componentes y pantallas
  shared/       base de datos, DI, errores de dominio, UI común
```

Decisiones principales (detalle en [`CLAUDE.md`](CLAUDE.md) y modelo en [`Architecture.md`](Architecture.md)):

- **Ports & adapters**: la UI depende de interfaces de repositorio, inyectadas con React Context; solo la _composition root_ conoce Dexie.
- **IndexedDB no tiene claves foráneas ni CHECK**: la integridad referencial (CASCADE, SET NULL, UNIQUE) y las reglas de negocio se aplican en los repositorios, dentro de transacciones.
- **Single source of truth**: el progreso se calcula, no se guarda (el "listo" de un compartimento sí es un dato propio, por decisión de producto: "el neceser está cerrado" no equivale a "todos sus artículos guardados"); las pantallas leen la base de datos con `useLiveQuery` y se actualizan solas.
- **Migraciones versionadas** del esquema de Dexie, cada una con su test.
- **Sin backend ni cuentas**, por decisión de producto: mantener la app lo más simple de usar posible.

## Puesta en marcha

Requisitos: Node.js (versión en [`.nvmrc`](.nvmrc)). En PowerShell:

```powershell
cd frontend
npm ci
npm run dev
```

Para probarla en el móvil en la misma red WiFi: `npm run dev -- --host` y abrir la dirección "Network" que muestra Vite.

Guía de desarrollo (scripts, estructura y tests): [`frontend/README.md`](frontend/README.md).
