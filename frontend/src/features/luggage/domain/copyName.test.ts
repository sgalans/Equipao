import { describe, expect, it } from 'vitest'
import { copyName } from './copyName'

describe('copyName', () => {
  it.each([
    ['Mochila', 'Mochila (copia)'],
    ['Mochila (copia)', 'Mochila (copia 2)'],
    ['Mochila (copia 2)', 'Mochila (copia 3)'],
    ['Mochila (copia 9)', 'Mochila (copia 10)'],
    // Solo cuenta el sufijo exacto, no "copia" en mitad del nombre.
    ['Copia de seguridad', 'Copia de seguridad (copia)'],
    ['Mochila (copiar)', 'Mochila (copiar) (copia)'],
  ])('%j → %j', (name, expected) => {
    expect(copyName(name)).toBe(expected)
  })

  it('nunca supera los 100 caracteres: recorta el nombre, no el sufijo', () => {
    const long = 'a'.repeat(100)

    const copy = copyName(long)

    expect(copy).toHaveLength(100)
    expect(copy.endsWith(' (copia)')).toBe(true)
  })
})
