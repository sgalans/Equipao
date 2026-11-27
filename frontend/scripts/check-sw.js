/**
 * Test de humo del build (CI): `npm run build && npm run check:sw`.
 * Lee dist/sw.js y la lista de ficheros de dist/ y aplica las reglas de
 * swChecks.js. Sale con código 1 si hay algún problema (el CI falla).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findServiceWorkerProblems } from './swChecks.js'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const swPath = join(dist, 'sw.js')

if (!existsSync(swPath)) {
  console.error('No existe dist/sw.js: ejecuta antes `npm run build`.')
  process.exit(1)
}

// Rutas relativas a dist/ y siempre con "/" (en Windows, readdirSync da "\").
const distFiles = readdirSync(dist, { recursive: true })
  .map(String)
  .filter((file) => statSync(join(dist, file)).isFile())
  .map((file) => file.split(sep).join('/'))

const problems = findServiceWorkerProblems({
  sw: readFileSync(swPath, 'utf8'),
  distFiles,
})

if (problems.length > 0) {
  console.error('El service worker no funcionaría sin conexión:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('Service worker OK: precaché sin duplicados y completa.')
