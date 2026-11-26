import { describe, expect, it } from 'vitest'
import {
  comparePositions,
  lastPosition,
  positionAfter,
  positionBetween,
  positionsAfter,
} from './position'

describe('position (fractional indexing)', () => {
  it('cada clave al final va detrás de la anterior', () => {
    const first = positionAfter(null)
    const second = positionAfter(first)
    expect(comparePositions(first, second)).toBeLessThan(0)
  })

  it('genera claves entre dos sin tocar las demás, tantas veces como haga falta', () => {
    const [a, b] = positionsAfter(null, 2)
    let middle = positionBetween(a, b)
    // Meter algo siempre justo detrás de `a`: cada clave queda entre a y la anterior.
    for (let i = 0; i < 50; i++) {
      const next = positionBetween(a, middle)
      expect(comparePositions(a, next)).toBeLessThan(0)
      expect(comparePositions(next, middle)).toBeLessThan(0)
      middle = next
    }
  })

  it('null a un lado = el principio o el final', () => {
    const [a] = positionsAfter(null, 1)
    expect(comparePositions(positionBetween(null, a), a)).toBeLessThan(0)
    expect(comparePositions(positionBetween(a, null), a)).toBeGreaterThan(0)
  })

  it('ordena por unidades de código, no alfabéticamente', () => {
    // En un orden "de idioma", 'a' y 'A' irían juntas; aquí 'Z' < 'a'.
    expect(comparePositions('Z', 'a')).toBeLessThan(0)
  })

  it('lastPosition da la mayor (o null si no hay)', () => {
    expect(lastPosition([])).toBeNull()
    expect(
      lastPosition([
        { position: 'a1' },
        { position: 'a3' },
        { position: 'a2' },
      ]),
    ).toBe('a3')
  })
})
