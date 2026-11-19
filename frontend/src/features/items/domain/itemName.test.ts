import { describe, expect, it } from 'vitest'
import { compareItemNames, isSameItemName } from './itemName'

describe('isSameItemName', () => {
  it.each([
    ['Cámara', 'camara', true],
    ['  Calcetines ', 'CALCETINES', true],
    ['Paño', 'Pano', false], // la ñ es otra letra
    ['Año', 'ano', false],
    ['Toalla', 'Toallas', false],
  ])('%j vs %j → %s', (a, b, expected) => {
    expect(isSameItemName(a, b)).toBe(expected)
  })
})

describe('compareItemNames', () => {
  it('ordena en español: tildes como su vocal y la ñ después de la n', () => {
    expect(
      ['Ñu', 'Zapatos', 'Álbum', 'Nube', 'abrigo'].sort(compareItemNames),
    ).toEqual(['abrigo', 'Álbum', 'Nube', 'Ñu', 'Zapatos'])
  })
})
