import { describe, expect, it } from 'vitest'
import { movedSummary, removedSummary } from './bulkSummary'

describe('bulkSummary', () => {
  it.each([
    [3, 'Neceser', 'Movidos 3 artículos a «Neceser».'],
    [1, 'Neceser', 'Movido 1 artículo a «Neceser».'],
    [2, null, 'Movidos 2 artículos a sueltos.'],
  ] as const)('movedSummary(%i, %j) → %j', (count, destination, expected) => {
    expect(movedSummary(count, destination)).toBe(expected)
  })

  it.each([
    [3, 'Quitados 3 artículos de la maleta.'],
    [1, 'Quitado 1 artículo de la maleta.'],
  ])('removedSummary(%i) → %j', (count, expected) => {
    expect(removedSummary(count)).toBe(expected)
  })
})
