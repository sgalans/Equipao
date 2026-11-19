import { describe, expect, it } from 'vitest'
import { ConsistencyError, EntityNotFoundError } from '@/shared/domain/errors'
import { createTestRepositories } from '@/test/repositories'

const MISSING_ID = '0190a0a0-0000-7000-8000-000000000000'

/** Maleta con un compartimento y un artículo dentro de él. */
async function setup() {
  const repos = createTestRepositories()
  const luggage = await repos.luggages.create({ name: 'Grande' })
  const kit = await repos.compartments.create({
    luggageId: luggage.id,
    name: ' Neceser ',
  })
  const brush = await repos.items.create({ name: 'Cepillo' })
  const quantity = await repos.quantities.add({
    luggageId: luggage.id,
    itemId: brush.id,
    compartmentId: kit.id,
    num: 1,
    nAlreadyPacked: 0,
  })
  return { ...repos, luggage, kit, brush, quantity }
}

describe('DexieCompartmentRepository', () => {
  it('crea compartimentos (normalizando el nombre) y los lista por maleta', async () => {
    const { compartments, luggage, kit } = await setup()
    const bag = await compartments.create({
      luggageId: luggage.id,
      name: 'Mochila de mano',
    })

    expect(kit.name).toBe('Neceser')
    expect(await compartments.listByLuggage(luggage.id)).toEqual([kit, bag])
  })

  it('FOREIGN KEY: no crea un compartimento en una maleta inexistente', async () => {
    const { compartments } = createTestRepositories()

    await expect(
      compartments.create({ luggageId: MISSING_ID, name: 'Huérfano' }),
    ).rejects.toMatchObject({ name: 'EntityNotFoundError', entity: 'Luggage' })
  })

  it('update renombra; lanza EntityNotFoundError si no existe', async () => {
    const { compartments, kit } = await setup()

    expect(await compartments.update(kit.id, { name: 'Aseo' })).toMatchObject({
      id: kit.id,
      name: 'Aseo',
    })
    await expect(
      compartments.update(MISSING_ID, { name: 'X' }),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('remove: ON DELETE SET NULL, sus artículos pasan a sueltos', async () => {
    const { compartments, quantities, luggage, kit, quantity } = await setup()

    await compartments.remove(kit.id)

    expect(await compartments.listByLuggage(luggage.id)).toEqual([])
    const [after] = await quantities.listByLuggage(luggage.id)
    expect(after).toMatchObject({ id: quantity.id, compartmentId: null })
  })

  it('al borrar la maleta se borran también sus compartimentos (CASCADE)', async () => {
    const { compartments, luggages, luggage } = await setup()

    await luggages.remove(luggage.id)

    expect(await compartments.listByLuggage(luggage.id)).toEqual([])
  })
})

describe('Invariante: el compartimento es de la misma maleta', () => {
  it('add rechaza un compartimento de otra maleta', async () => {
    const { luggages, compartments, items, quantities, luggage } = await setup()
    const other = await luggages.create({ name: 'Otra' })
    const otherKit = await compartments.create({
      luggageId: other.id,
      name: 'Neceser',
    })
    const towel = await items.create({ name: 'Toalla' })

    await expect(
      quantities.add({
        luggageId: luggage.id,
        itemId: towel.id,
        compartmentId: otherKit.id,
        num: 1,
        nAlreadyPacked: 0,
      }),
    ).rejects.toBeInstanceOf(ConsistencyError)
  })

  it('add sin compartimento deja el artículo suelto (null por defecto)', async () => {
    const { items, quantities, luggage } = await setup()
    const towel = await items.create({ name: 'Toalla' })

    const added = await quantities.add({
      luggageId: luggage.id,
      itemId: towel.id,
      num: 1,
      nAlreadyPacked: 0,
    })

    expect(added.compartmentId).toBeNull()
  })

  it('moveTo mueve entre compartimento y sueltos', async () => {
    const { quantities, compartments, luggage, quantity } = await setup()
    const bag = await compartments.create({
      luggageId: luggage.id,
      name: 'Mochila',
    })

    expect(await quantities.moveTo(quantity.id, bag.id)).toMatchObject({
      compartmentId: bag.id,
    })
    expect(await quantities.moveTo(quantity.id, null)).toMatchObject({
      compartmentId: null,
    })
  })

  it('moveTo rechaza un compartimento de otra maleta o inexistente', async () => {
    const { quantities, luggages, compartments, quantity } = await setup()
    const other = await luggages.create({ name: 'Otra' })
    const otherKit = await compartments.create({
      luggageId: other.id,
      name: 'Neceser',
    })

    await expect(
      quantities.moveTo(quantity.id, otherKit.id),
    ).rejects.toBeInstanceOf(ConsistencyError)
    await expect(
      quantities.moveTo(quantity.id, MISSING_ID),
    ).rejects.toMatchObject({
      name: 'EntityNotFoundError',
      entity: 'Compartment',
    })
  })
})

describe('Compartimentos "listos" (estado propio)', () => {
  it('se crean sin marcar, y toggleReady los marca y desmarca', async () => {
    const { compartments, kit } = await setup()
    expect(kit.isReady).toBe(false)

    expect(await compartments.toggleReady(kit.id)).toMatchObject({
      isReady: true,
    })
    expect(await compartments.toggleReady(kit.id)).toMatchObject({
      isReady: false,
    })
  })

  it('marcarlo NO toca sus artículos (son independientes)', async () => {
    const { compartments, quantities, luggage, kit, quantity } = await setup()

    await compartments.toggleReady(kit.id)

    expect(await quantities.listByLuggage(luggage.id)).toEqual([quantity])
  })

  it('toggleReady lanza EntityNotFoundError si no existe', async () => {
    const { compartments } = createTestRepositories()

    await expect(compartments.toggleReady(MISSING_ID)).rejects.toBeInstanceOf(
      EntityNotFoundError,
    )
  })
})
