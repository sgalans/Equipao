import { describe, expect, it } from 'vitest'
import { isSameItemName } from '@/features/items/domain/itemName'
import { DescriptionSchema } from '@/features/luggage/domain/luggage'
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

  it('la descripción de la maleta básica es válida (máx. 1000) y su primera línea invita a abrirla', () => {
    // El mismo esquema que valida la app: si un truco nuevo la alarga de
    // más, falla aquí (y en el CI) y no al instalar la app.
    expect(DescriptionSchema.safeParse(BASIC_LUGGAGE.description).success).toBe(
      true,
    )
    // La tarjeta del listado solo muestra la primera línea: que anuncie las
    // instrucciones (la frase exacta se puede retocar sin tocar el test).
    expect(BASIC_LUGGAGE.description.split('\n')[0]).toMatch(/^Instrucciones/)
  })
})
