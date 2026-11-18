import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
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

  describe('update', () => {
    it('actualiza las cantidades', async () => {
      const { quantities, luggage, socks } = await setup()
      const q = await quantities.add({
        luggageId: luggage.id,
        itemId: socks.id,
        num: 5,
        nAlreadyPacked: 0,
      })

      const updated = await quantities.update(q.id, { nAlreadyPacked: 3 })

      expect(updated).toMatchObject({ num: 5, nAlreadyPacked: 3 })
    })

    it('CHECK: no deja bajar num por debajo de lo ya empaquetado', async () => {
      const { quantities, luggage, socks } = await setup()
      const q = await quantities.add({
        luggageId: luggage.id,
        itemId: socks.id,
        num: 5,
        nAlreadyPacked: 4,
      })

      await expect(quantities.update(q.id, { num: 3 })).rejects.toBeInstanceOf(
        ZodError,
      )
      expect((await quantities.listByLuggage(luggage.id))[0]).toEqual(q)
    })

    it('lanza EntityNotFoundError si no existe', async () => {
      const { quantities } = await setup()

      await expect(
        quantities.update(MISSING_ID, { num: 1 }),
      ).rejects.toBeInstanceOf(EntityNotFoundError)
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
