import { describe, expect, it } from 'vitest'
import { addedSummary } from './addedSummary'

describe('addedSummary', () => {
  it.each([
    [3, 0, 'Añadidos 3 artículos a «Mochila».'],
    [1, 0, 'Añadido 1 artículo a «Mochila».'],
    [2, 1, 'Añadidos 2 artículos a «Mochila». 1 ya estaba.'],
    [1, 2, 'Añadido 1 artículo a «Mochila». 2 ya estaban.'],
    [0, 2, 'No se ha añadido nada a «Mochila». 2 ya estaban.'],
  ])('%i añadidos y %i saltados → %j', (added, skipped, expected) => {
    expect(addedSummary(added, skipped, 'Mochila')).toBe(expected)
  })
})
