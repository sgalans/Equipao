import { describe, expect, it } from 'vitest'
import { DuplicateError, EntityNotFoundError } from '@/shared/domain/errors'
import { createTestRepositories } from '@/test/repositories'

const MISSING_ID = '0190a0a0-0000-7000-8000-000000000000'

/** Maleta + ítem del catálogo, listos para relacionarse. */
async function setup() {
  const repos = createTestRepositories()
  const luggage = await repos.luggages.create({ name: 'Grande' })
  const socks = await repos.items.create({ name: 'Calcetines' })
  return { ...repos, luggage, socks }
}

describe('DexieItemQuantityRepository', () => {
  describe('add', () => {
    it('añade un ítem a la maleta', async () => {
      const { quantities, luggage, socks } = await setup()

      const q = await quantities.add({
        luggageId: luggage.id,
        itemId: socks.id,
        num: 5,
        nAlreadyPacked: 0,
      })

      expect(await quantities.listByLuggage(luggage.id)).toEqual([q])
    })

    it.each([
      ['Luggage', { luggageId: MISSING_ID }],
      ['Item', { itemId: MISSING_ID }],
    ])('FOREIGN KEY: rechaza un %s inexistente', async (entity, override) => {
      const { quantities, luggage, socks } = await setup()

      await expect(
        quantities.add({
          luggageId: luggage.id,
          itemId: socks.id,
          num: 1,
          nAlreadyPacked: 0,
          ...override,
        }),
      ).rejects.toMatchObject({ name: 'EntityNotFoundError', entity })
    })

    it('UNIQUE: traduce el ConstraintError de Dexie a DuplicateError', async () => {
      const { quantities, luggage, socks } = await setup()
      const input = {
        luggageId: luggage.id,
        itemId: socks.id,
        num: 1,
        nAlreadyPacked: 0,
      }
      await quantities.add(input)

      await expect(quantities.add(input)).rejects.toBeInstanceOf(DuplicateError)
      expect(await quantities.listByLuggage(luggage.id)).toHaveLength(1)
    })
  })

  it('remove quita el ítem de la maleta, pero no del catálogo', async () => {
    const { quantities, items, luggage, socks } = await setup()
    const q = await quantities.add({
      luggageId: luggage.id,
      itemId: socks.id,
      num: 1,
      nAlreadyPacked: 0,
    })

    await quantities.remove(q.id)

    expect(await quantities.listByLuggage(luggage.id)).toEqual([])
    expect(await items.getById(socks.id)).toEqual(socks)
  })
})

describe('DexieItemQuantityRepository: empaquetado y lectura', () => {
  async function setupWithQuantity(num: number, nAlreadyPacked = 0) {
    const repos = createTestRepositories()
    const luggage = await repos.luggages.create({ name: 'Grande' })
    const socks = await repos.items.create({ name: 'Calcetines' })
    const quantity = await repos.quantities.add({
      luggageId: luggage.id,
      itemId: socks.id,
      num,
      nAlreadyPacked,
    })
    return { ...repos, luggage, socks, quantity }
  }

  it('togglePacked guarda todo y, con otro toque, lo saca todo', async () => {
    const { quantities, quantity } = await setupWithQuantity(5)

    expect(await quantities.togglePacked(quantity.id)).toMatchObject({
      nAlreadyPacked: 5,
    })
    expect(await quantities.togglePacked(quantity.id)).toMatchObject({
      nAlreadyPacked: 0,
    })
  })

  it('resize al alza conserva lo guardado (5/5 → 5/6)', async () => {
    const { quantities, quantity } = await setupWithQuantity(5, 5)

    expect(await quantities.resize(quantity.id, 6)).toMatchObject({
      num: 6,
      nAlreadyPacked: 5,
    })
  })

  it('cambiar la cantidad de algo listo lo deja sin marcar (suba o baje); volver a ella, listo otra vez', async () => {
    const { quantities, quantity } = await setupWithQuantity(5, 5)

    // Se recuerda con cuántas se marcó (5), aunque ahora haya 4.
    expect(await quantities.resize(quantity.id, 4)).toMatchObject({
      num: 4,
      nAlreadyPacked: 5,
    })
    expect(await quantities.resize(quantity.id, 6)).toMatchObject({
      num: 6,
      nAlreadyPacked: 5,
    })
    expect(await quantities.resize(quantity.id, 5)).toMatchObject({
      num: 5,
      nAlreadyPacked: 5, // = listo
    })
  })

  it('togglePacked y resize lanzan EntityNotFoundError si no existe', async () => {
    const { quantities } = await setupWithQuantity(1)

    await expect(quantities.togglePacked(MISSING_ID)).rejects.toBeInstanceOf(
      EntityNotFoundError,
    )
    await expect(quantities.resize(MISSING_ID, 2)).rejects.toBeInstanceOf(
      EntityNotFoundError,
    )
  })

  it('listEntriesByLuggage incluye el nombre del artículo, en orden de añadido', async () => {
    const { quantities, items, luggage, quantity } = await setupWithQuantity(5)
    const charger = await items.create({ name: 'Cargador' })
    await quantities.add({
      luggageId: luggage.id,
      itemId: charger.id,
      num: 1,
      nAlreadyPacked: 0,
    })

    const entries = await quantities.listEntriesByLuggage(luggage.id)

    expect(entries.map((e) => e.itemName)).toEqual(['Calcetines', 'Cargador'])
    expect(entries[0]).toEqual({ ...quantity, itemName: 'Calcetines' })
  })
})
