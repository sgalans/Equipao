/**
 * Test de humo del service worker generado (dist/sw.js): reglas puras, sin
 * leer disco, para poder probarlas (swChecks.test.js). Las usa check-sw.js
 * tras `npm run build`.
 *
 * Origen: en v1.0.0 el manifest salía DOS veces en la precaché, Workbox
 * lanzaba `add-to-cache-list-conflicting-entries` al instalarse y la app no
 * funcionaba sin conexión. Ni los tests ni el build lo detectaban: el fallo
 * solo se veía en el navegador. Esto lo comprueba en el CI.
 */

/**
 * URLs de la precaché: el array que Workbox (generateSW) escribe en
 * `precacheAndRoute([{url:"…",revision:…}, …])`. Devuelve null si no lo
 * encuentra (p. ej. si cambia el formato de Workbox): mejor fallar claro que
 * dar por bueno un service worker que no se ha podido leer.
 * @param {string} sw contenido de sw.js
 * @returns {string[] | null}
 */
export function parsePrecacheUrls(sw) {
  const start = sw.indexOf('precacheAndRoute([')
  if (start === -1) return null
  // El array termina en el primer "]": las URLs no llevan corchetes.
  const end = sw.indexOf(']', start)
  if (end === -1) return null
  const list = sw.slice(start, end)
  return [...list.matchAll(/url:\s*["']([^"']+)["']/g)].map((m) => m[1])
}

/**
 * Lista de problemas (vacía = todo bien).
 * @param {{ sw: string, distFiles: string[] }} input
 *   distFiles: rutas relativas a dist/, con "/" (p. ej. "assets/index-x.js").
 * @returns {string[]}
 */
export function findServiceWorkerProblems({ sw, distFiles }) {
  const urls = parsePrecacheUrls(sw)
  if (urls === null || urls.length === 0) {
    return ['No se encuentra la lista de precaché (precacheAndRoute) en sw.js.']
  }
  const problems = []
  const precached = new Set(urls)
  const files = new Set(distFiles)

  // 1. Sin duplicados: Workbox no se instala si una URL se repite.
  const duplicates = new Set(urls.filter((url, i) => urls.indexOf(url) !== i))
  for (const url of duplicates) {
    problems.push(`URL repetida en la precaché: ${url}`)
  }

  // 2. Lo imprescindible para arrancar sin conexión.
  for (const url of ['index.html', 'manifest.webmanifest']) {
    if (!precached.has(url)) problems.push(`Falta en la precaché: ${url}`)
  }

  // 3. Todo el código y los estilos, también los chunks de las pantallas
  //    con `lazy`: si Workbox se dejara uno (p. ej. por superar el tamaño
  //    máximo), esa pantalla fallaría sin conexión.
  for (const file of distFiles) {
    if (file.startsWith('assets/') && !precached.has(file)) {
      problems.push(`Fichero sin precachear: ${file}`)
    }
  }

  // 4. Nada que apunte a un fichero que no existe (la instalación fallaría).
  for (const url of precached) {
    if (!files.has(url)) problems.push(`Precacheado pero no existe: ${url}`)
  }

  // 5. SPA sin conexión: cualquier ruta (/luggages/123…) sirve index.html.
  const navigationRoute =
    /NavigationRoute\(\s*\w+\.createHandlerBoundToURL\(\s*["']index\.html["']/
  if (!navigationRoute.test(sw)) {
    problems.push('Falta el NavigationRoute hacia index.html.')
  }

  return problems
}
