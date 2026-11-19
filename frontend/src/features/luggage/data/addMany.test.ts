import { describe, expect, it } from 'vitest'
import { ConsistencyError, EntityNotFoundError } from '@/shared/domain/errors'
import { createTestRepositories } from '@/test/repositories'

const MISSING_ID = '0190a0a0-0000-7000-8000-000000000000'

/** Maleta con "Cepillo" ya dentro y un catálogo de 3 artículos. */
async function setup() {
  const repos = createTestRepositories()
  const luggage = await repos.luggages.create({ name: 'Mochila' })
  const brush = await repos.items.create({ name: 'Cepillo' })
  const paste = await repos.items.create({ name: 'Pasta' })
  const towel = await repos.items.create({ name: 'Toalla' })
  await repos.quantities.add({
    luggageId: luggage.id,
    itemId: brush.id,
    num: 3,
    nAlreadyPacked: 1,
  })
  return { ...repos, luggage, brush, paste, towel }
}

describe('ItemQuantityRepository.addMany', () => {
  it('añade los que faltan (cantidad 1, sin guardar) e ignora los que ya estaban', async () => {
    const { quantities, luggage, brush, paste, towel } = await setup()

    const result = await quantities.addMany(luggage.id, [
      brush.id,
      paste.id,
      towel.id,
    ])

    expect(result.added.map((q) => q.itemId)).toEqual([paste.id, towel.id])
    expect(
      result.added.every((q) => q.num === 1 && q.nAlreadyPacked === 0),
    ).toBe(true)
    expect(result.skippedItemIds).toEqual([brush.id])
    // El que ya estaba NO cambia: ni se duplica ni suma cantidad.
    const lines = await quantities.listByLuggage(luggage.id)
    expect(lines).toHaveLength(3)
    expect(lines.find((q) => q.itemId === brush.id)).toMatchObject({
      num: 3,
      nAlreadyPacked: 1,
    })
  })

  it('es idempotente: repetir la misma operación no cambia nada', async () => {
    const { quantities, luggage, paste, towel } = await setup()
    await quantities.addMany(luggage.id, [paste.id, towel.id])
    const before = await quantities.listByLuggage(luggage.id)

    const again = await quantities.addMany(luggage.id, [paste.id, towel.id])

    expect(again.added).toEqual([])
    expect(await quantities.listByLuggage(luggage.id)).toEqual(before)
  })

  it('un id repetido en la petición se añade una sola vez', async () => {
    const { quantities, luggage, paste } = await setup()

    const result = await quantities.addMany(luggage.id, [paste.id, paste.id])

    expect(result.added).toHaveLength(1)
  })

  it('puede añadirlos directamente dentro de un compartimento', async () => {
    const { quantities, compartments, luggage, paste, towel } = await setup()
    const kit = await compartments.create({
      luggageId: luggage.id,
      name: 'Neceser',
    })

    const result = await quantities.addMany(
      luggage.id,
      [paste.id, towel.id],
      kit.id,
    )

    expect(result.added.every((q) => q.compartmentId === kit.id)).toBe(true)
  })

  it('todo o nada: si un artículo no existe, no añade ninguno', async () => {
    const { quantities, luggage, paste } = await setup()

    await expect(
      quantities.addMany(luggage.id, [paste.id, MISSING_ID]),
    ).rejects.toMatchObject({ name: 'EntityNotFoundError', entity: 'Item' })
    expect(await quantities.listByLuggage(luggage.id)).toHaveLength(1)
  })

  it('lanza EntityNotFoundError si la maleta no existe', async () => {
    const { quantities, paste } = await setup()

    await expect(
      quantities.addMany(MISSING_ID, [paste.id]),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('lanza ConsistencyError si el compartimento es de otra maleta', async () => {
    const { quantities, compartments, luggages, luggage, paste } = await setup()
    const other = await luggages.create({ name: 'Otra' })
    const otherKit = await compartments.create({
      luggageId: other.id,
      name: 'Neceser',
    })

    await expect(
      quantities.addMany(luggage.id, [paste.id], otherKit.id),
    ).rejects.toBeInstanceOf(ConsistencyError)
  })
})
