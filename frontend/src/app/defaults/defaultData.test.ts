import { describe, expect, it } from 'vitest'
import { isSameItemName } from '@/features/items/domain/itemName'
import { BASIC_LUGGAGE, DEFAULT_CATALOG } from './defaultData'

/**
 * Tests de los DATOS por defecto: protegen frente a errores al editarlos
 * (que no son código, pero rompen igual).
 */
describe('Datos por defecto', () => {
  it('el catálogo no tiene nombres repetidos (con el criterio del catálogo)', () => {
    const clashes = DEFAULT_CATALOG.flatMap((name, i) =>
      DEFAULT_CATALOG.slice(i + 1)
        .filter((other) => isSameItemName(name, other))
        .map((other) => `${name} = ${other}`),
    )

    expect(clashes).toEqual([])
  })

  it('todo lo de la maleta básica está en el catálogo por defecto', () => {
    const inBasic = [
      ...BASIC_LUGGAGE.loose,
      ...BASIC_LUGGAGE.compartments.flatMap((c) => c.items),
    ]
    const missing = inBasic.filter(
      (name) => !DEFAULT_CATALOG.some((item) => isSameItemName(item, name)),
    )

    expect(missing).toEqual([])
  })

  it('cada artículo está una sola vez en la maleta básica', () => {
    const inBasic = [
      ...BASIC_LUGGAGE.loose,
      ...BASIC_LUGGAGE.compartments.flatMap((c) => c.items),
    ]

    expect(new Set(inBasic).size).toBe(inBasic.length)
  })
})
