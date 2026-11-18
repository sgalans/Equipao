import { describe, expect, it } from 'vitest'
import { normalizeForSearch, suggestItems } from './search'

const item = (name: string) => ({ id: name, name })
const catalog = [
  'Calcetines',
  'Cámara',
  'Cargador',
  'Pasaporte',
  'Cepillo de dientes',
].map(item)
const none = new Set<string>()
const names = (items: { name: string }[]) => items.map((i) => i.name)

describe('normalizeForSearch', () => {
  it('ignora mayúsculas, tildes y espacios de los extremos', () => {
    expect(normalizeForSearch('  Cámara ')).toBe('camara')
  })
})

describe('suggestItems', () => {
  it('sin texto no sugiere nada', () => {
    expect(suggestItems(catalog, '  ', none)).toEqual([])
  })

  it('encuentra sin distinguir tildes ni mayúsculas', () => {
    expect(names(suggestItems(catalog, 'CAMARA', none))).toEqual(['Cámara'])
  })

  it('pone primero lo que empieza por el texto y después lo que lo contiene', () => {
    // "Funda de cámara" va ANTES en el catálogo, pero solo CONTIENE "cam":
    // debe salir detrás de "Cámara", que EMPIEZA por "cam".
    const withCase = [item('Funda de cámara'), ...catalog]

    expect(names(suggestItems(withCase, 'cam', none))).toEqual([
      'Cámara',
      'Funda de cámara',
    ])
  })

  it('excluye lo que ya está en la maleta', () => {
    expect(names(suggestItems(catalog, 'ca', new Set(['Cámara'])))).toEqual([
      'Calcetines',
      'Cargador',
    ])
  })

  it('respeta el límite', () => {
    expect(suggestItems(catalog, 'a', none, 2)).toHaveLength(2)
  })
})
