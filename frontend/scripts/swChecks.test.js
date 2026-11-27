import { describe, expect, it } from 'vitest'
import { findServiceWorkerProblems, parsePrecacheUrls } from './swChecks.js'

/** Un sw.js mínimo con el formato que genera Workbox (generateSW). */
function fakeSw(urls, { navigation = true } = {}) {
  const entries = urls.map((url) => `{url:"${url}",revision:null}`).join(',')
  const route = navigation
    ? ',e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))'
    : ''
  return `define(["./workbox-1"],function(e){e.precacheAndRoute([${entries}],{}),e.cleanupOutdatedCaches()${route}});`
}

const OK_FILES = ['index.html', 'manifest.webmanifest', 'assets/index-a.js']

describe('parsePrecacheUrls', () => {
  it('lee las URLs de precacheAndRoute', () => {
    expect(parsePrecacheUrls(fakeSw(OK_FILES))).toEqual(OK_FILES)
  })

  it('sin precacheAndRoute, null', () => {
    expect(parsePrecacheUrls('console.log(1)')).toBeNull()
  })
})

describe('findServiceWorkerProblems', () => {
  const check = (urls, distFiles = OK_FILES, options) =>
    findServiceWorkerProblems({ sw: fakeSw(urls, options), distFiles })

  it('un service worker correcto no tiene problemas', () => {
    expect(check(OK_FILES)).toEqual([])
  })

  it('detecta una URL repetida (el fallo de v1.0.0)', () => {
    expect(check([...OK_FILES, 'manifest.webmanifest'])).toEqual([
      'URL repetida en la precaché: manifest.webmanifest',
    ])
  })

  it('exige index.html y el manifest', () => {
    expect(check(['assets/index-a.js'])).toEqual([
      'Falta en la precaché: index.html',
      'Falta en la precaché: manifest.webmanifest',
    ])
  })

  it('detecta un chunk de assets/ sin precachear', () => {
    expect(check(OK_FILES, [...OK_FILES, 'assets/Lazy-b.js'])).toEqual([
      'Fichero sin precachear: assets/Lazy-b.js',
    ])
  })

  it('detecta una URL precacheada que no existe en dist', () => {
    expect(check([...OK_FILES, 'assets/old.js'])).toEqual([
      'Precacheado pero no existe: assets/old.js',
    ])
  })

  it('exige el NavigationRoute hacia index.html', () => {
    expect(check(OK_FILES, OK_FILES, { navigation: false })).toEqual([
      'Falta el NavigationRoute hacia index.html.',
    ])
  })

  it('si no puede leer la precaché, lo dice (no da por bueno nada)', () => {
    expect(
      findServiceWorkerProblems({ sw: 'self.x=1', distFiles: OK_FILES }),
    ).toEqual([
      'No se encuentra la lista de precaché (precacheAndRoute) en sw.js.',
    ])
  })
})
