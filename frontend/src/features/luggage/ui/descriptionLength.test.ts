import { describe, expect, it } from 'vitest'
import { isLongDescription } from './descriptionLength'

describe('isLongDescription', () => {
  it('corta (una o pocas líneas): no', () => {
    expect(isLongDescription('Playa en julio')).toBe(false)
    expect(isLongDescription('Uno\nDos\nTres')).toBe(false)
  })

  it('más de 3 líneas escritas: sí', () => {
    expect(isLongDescription('Uno\nDos\nTres\nCuatro')).toBe(true)
  })

  it('una sola línea muy larga (pasaría de 3 en un iPhone): sí', () => {
    expect(isLongDescription('a'.repeat(181))).toBe(true)
  })
})
