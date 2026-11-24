# Guía práctica de Equipao

Cómo se hacen las cosas habituales en este proyecto. Los comandos son para **PowerShell** y se ejecutan desde la raíz del repositorio, salvo que se diga otra cosa.

- [1. Backlog: Issues y tablero](#1-backlog-issues-y-tablero)
- [2. De un issue a producción](#2-de-un-issue-a-producción)
- [3. Hotfix: arreglar algo urgente en producción](#3-hotfix-arreglar-algo-urgente-en-producción)
- [4. Comandos del día a día](#4-comandos-del-día-a-día)
- [5. Probar en el iPhone](#5-probar-en-el-iphone)
- [6. Cambiar el esquema de la base de datos](#6-cambiar-el-esquema-de-la-base-de-datos)
- [7. Trabajar con Claude Code](#7-trabajar-con-claude-code)

---

## 1. Backlog: Issues y tablero

El backlog son los **issues** de GitHub; el **tablero** (GitHub Projects) los ordena y muestra en qué estado está cada uno.

- Issues: https://github.com/sgalans/Equipao/issues
- Tablero: https://github.com/users/sgalans/projects/1

### Etiquetas

| Etiqueta | Para qué |
|---|---|
| `prioridad: alta` / `media` / `baja` | Cuándo se hace |
| `feature` | Algo que nota quien usa la app |
| `tech` | Herramientas, calidad, rendimiento |
| `a decidir` | Hay que acordar el alcance antes de empezar |

### Ver

- **Web**: la lista de issues; filtra pulsando una etiqueta o con el buscador: `is:open label:"prioridad: alta"`.
- **iPhone**: app **GitHub Mobile** (ideal para apuntar una idea en el momento).
- **VS Code**: extensión **GitHub Pull Requests**.
- **Terminal**:
  ```powershell
  gh issue list                            # abiertos
  gh issue list --label "prioridad: alta"  # filtrados
  gh issue view 14                         # detalle
  gh issue view 14 --web                   # abrir en el navegador
  ```

### Añadir, editar, quitar

| Acción | Web | Terminal |
|---|---|---|
| Añadir | **New issue** | `gh issue create` (te pregunta título, texto y etiquetas) |
| Cambiar prioridad | etiquetas, en la columna derecha | `gh issue edit 14 --add-label "prioridad: media" --remove-label "prioridad: alta"` |
| Editar el texto | lápiz junto al texto | `gh issue edit 14 --body-file nota.md` |
| Descartar | **Close issue → Close as not planned** | `gh issue close 30 --reason "not planned"` |
| Recuperar | **Reopen issue** | `gh issue reopen 30` |

- **No se borra, se cierra.** Cerrar como *not planned* deja constancia de que se descartó y por qué; si la idea vuelve, ya está la decisión tomada. Borrar (**Delete issue**) solo para duplicados o errores.
- **Las decisiones van en comentarios del issue** (p. ej. "vamos con la opción A porque…"): quedan junto a la tarea.
- Los issues nuevos **no entran solos en el tablero** salvo que actives el *auto-add* (ver abajo); si no, desde el issue: columna derecha → **Projects → Equipao**.

### El tablero

- Columnas: **Todo** (por hacer) → **In Progress** (en curso) → **Done** (hecho).
- **Arrastra** las tarjetas para ordenarlas: lo de arriba de "Todo" es lo siguiente. Es el orden fino que las etiquetas de prioridad no dan.
- Al empezar una tarea, muévela a **In Progress** (una o dos a la vez como mucho: limitar el trabajo en curso es una idea de Kanban).
- Al cerrarse el issue, pasa sola a **Done** (automatización *Item closed*).

**Configuración que solo se puede hacer en la web** (una vez):

1. Vista de tablero: en el tablero, la pestaña de la vista → **Layout: Board**.
2. Automatizaciones: menú **⋯ → Workflows**:
   - *Item closed* y *Pull request merged* → **Done** (vienen activadas; comprobarlo).
   - *Auto-add to project*: activar con el filtro `is:issue` para que cada issue nuevo entre en el tablero.

---

## 2. De un issue a producción

```
issue → rama desde develop → commits → PR a develop → PR de release develop → main → tag
```

1. **Acordar el alcance** del issue (con Claude o en un comentario del issue).
2. **Rama** desde `develop`, con el número del issue:
   ```powershell
   git switch develop
   git pull
   git switch -c feature/14-compartir-texto     # fix/… para arreglos, chore/… para mantenimiento
   ```
   Mueve la tarjeta a **In Progress**.
3. **Commits pequeños** con Conventional Commits, comprobando antes:
   ```powershell
   cd frontend; npm run check; cd ..
   git add <ficheros>
   git commit -m "feat: share luggage as text"
   ```
   Tipos: `feat` (funcionalidad), `fix` (arreglo), `docs`, `test`, `refactor`, `perf`, `chore` (mantenimiento).
4. **PR a `develop`**:
   ```powershell
   git push -u origin feature/14-compartir-texto
   gh pr create --fill     # va a develop: es la rama por defecto del repositorio
   ```
   En la descripción, **`Closes #14`**: enlaza la PR con el issue.
5. **Esperar al CI** (GitHub Actions, `.github/workflows/ci.yml`): repite `npm run check` y el build. Con el CI en rojo no se puede mergear. Para verlo: la pestaña *Checks* de la PR o `gh pr checks --watch`.
6. **Probar la vista previa** de Vercel (enlace en la PR), también en el iPhone. **Autorrevisar** el diff en la pestaña *Files changed* y mergear.
7. **Release** (cuando haya algo que publicar):
   ```powershell
   gh pr create --base main --head develop --title "release: v1.1.0"
   ```
   Al mergearla, Vercel publica `main`.

   > **Cuándo se cierra el issue**: GitHub cierra los `Closes #…` al mergear en la **rama por defecto** del repositorio, que es `develop`. Así que un issue cerrado significa "hecho e integrado", **no** "en producción": lo que está en producción lo dicen los *tags*.
8. **Tag** con versionado semántico (`MAYOR.MENOR.PARCHE`):
   ```powershell
   git switch main
   git pull
   git tag -a v1.1.0 -m "v1.1.0"
   git push origin v1.1.0
   ```
   - PARCHE (1.0.**1**): solo arreglos.
   - MENOR (1.**1**.0): funcionalidades nuevas compatibles.
   - MAYOR (**2**.0.0): cambios incompatibles (en esta app, p. ej., un formato de importación que deja de aceptar lo antiguo).

---

## 3. Hotfix: arreglar algo urgente en producción

Un fallo en producción no espera a la siguiente release, pero sigue el mismo camino corto:

```powershell
git switch develop; git pull
git switch -c fix/offline-precache
# … arreglo + npm run check + commit "fix: …"
git push -u origin fix/offline-precache
gh pr create --fill      # a develop; y después la PR de release develop → main
```

Tag de PARCHE (`v1.0.1`). Si en `develop` hubiera cosas a medias que no deben salir todavía, la alternativa es sacar la rama de `main` y mergearla en `main` **y** en `develop` (el *hotfix* clásico de git-flow).

Truco: si ya habías empezado a cambiar cosas en otra rama, `git stash` las guarda aparte y `git stash pop` las recupera en la rama nueva.

---

## 4. Comandos del día a día

En `frontend/`:

| Comando | Qué hace |
|---|---|
| `npm run dev` | App en local con recarga al guardar (sin service worker) |
| `npm run check` | typecheck + lint + formato + tests. **Antes de cada commit** |
| `npm run test` | Tests en modo *watch* (se repiten al guardar) |
| `npm run format` | Formatea todo con Prettier |
| `npm run build` | Compila para producción en `dist/` |
| `npm run preview` | Sirve `dist/` como en producción (con service worker) |

---

## 5. Probar en el iPhone

- **En desarrollo**: `npm run dev -- --host` y abre en el iPhone la dirección *Network* (misma WiFi). No hay service worker: no sirve para probar el modo sin conexión.
- **Antes de mergear**: la **vista previa de la PR** (Vercel). Está protegida: hay que entrar con la cuenta de Vercel.
- **Sin conexión** (en producción o en la vista previa):
  1. Abrir la app **con conexión** y esperar unos segundos (descarga todo).
  2. Cerrarla del todo y volver a abrirla.
  3. Modo avión → abrirla: debe funcionar.
  - En Chrome del PC: DevTools → *Application* → *Service workers* debe decir *activated and running*; en *Network* se puede marcar *Offline*.
- **Actualizaciones**: tras publicar, la app instalada muestra "Nueva versión disponible" (Luego / Actualizar). Puede tardar: comprueba al abrirse y cada hora.
- **Ojo con los datos**: en iOS, la app instalada y Safari **no comparten datos**. Borrar el icono de la pantalla de inicio **borra sus datos**.

---

## 6. Cambiar el esquema de la base de datos

Hay datos reales en los móviles: **nunca se modifica una versión ya publicada**. Cada cambio es una versión nueva de Dexie.

1. En `src/shared/db/db.ts`: nueva `SCHEMA_Vn` (exportada) y `db.version(n).stores(...)`; si hay que transformar datos existentes, `.upgrade(tx => …)` (p. ej. poner un valor por defecto al campo nuevo).
2. Actualizar el esquema Zod de la entidad (fuente de verdad de los tipos).
3. Test en `db.migration.test.ts`: crear una BD con la versión anterior y datos, abrirla con la nueva y comprobar el resultado.
4. Actualizar `Architecture.md` (modelo) y, si cambia una decisión, `CLAUDE.md`.

Más de un cambio de esquema planeado (p. ej. "último momento" y "por comprar") → mejor juntarlos en una sola migración.

---

## 7. Trabajar con Claude Code

- **`CLAUDE.md` se carga solo** al empezar cada sesión: no hace falta mencionarlo con `@` ni tenerlo abierto. Se paga en cada mensaje, así que conviene que sea corto y esté al día (el backlog y el historial viven en GitHub, no ahí).
- Para cosas puntuales, menciona el fichero con `@ruta` o selecciónalo en el editor.
- Peticiones útiles: "¿qué hay en el backlog?", "empecemos el #15", "revisa, no reescribas", "propón el mensaje de commit".
- **Los commits, push y PRs los haces tú**; Claude prepara los cambios y propone el mensaje.
