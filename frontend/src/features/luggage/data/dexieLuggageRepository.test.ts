import { describe, expect, it } from 'vitest'
import { EntityNotFoundError } from '@/shared/domain/errors'
import { createTestRepositories } from '@/test/repositories'

const MISSING_ID = '0190a0a0-0000-7000-8000-000000000000'

/** Repositorios + un viaje ya creado, que casi todos los tests necesitan. */
async function setup() {
  const repos = createTestRepositories()
  const trip = await repos.trips.create({
    name: 'Japón',
    startDate: '2027-04-01',
    endDate: '2027-04-15',
  })
  return { ...repos, trip }
}

describe('DexieLuggageRepository', () => {
  it('crea maletas y las lista por viaje en orden de creación', async () => {
    const { luggages, trip } = await setup()
    await luggages.create({ tripId: trip.id, name: 'Grande' })
    await luggages.create({ tripId: trip.id, name: 'Mochila' })

    const names = (await luggages.listByTrip(trip.id)).map((l) => l.name)

    expect(names).toEqual(['Grande', 'Mochila'])
  })

  it('FOREIGN KEY: no crea una maleta para un viaje inexistente', async () => {
    const { luggages, db } = await setup()

    await expect(
      luggages.create({ tripId: MISSING_ID, name: 'Huérfana' }),
    ).rejects.toMatchObject({ name: 'EntityNotFoundError', entity: 'Trip' })
    expect(await db.luggages.count()).toBe(0)
  })

  it('update solo cambia el nombre', async () => {
    const { luggages, trip } = await setup()
    const luggage = await luggages.create({ tripId: trip.id, name: 'Grande' })

    const updated = await luggages.update(luggage.id, { name: 'Maleta roja' })

    expect(updated).toMatchObject({ name: 'Maleta roja', tripId: trip.id })
  })

  it('update lanza EntityNotFoundError si la maleta no existe', async () => {
    const { luggages } = await setup()

    await expect(
      luggages.update(MISSING_ID, { name: 'X' }),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('remove borra la maleta y su contenido (CASCADE), no el de otras', async () => {
    const { luggages, quantities, items, trip, db } = await setup()
    const socks = await items.create({ name: 'Calcetines', color: '#3366ff' })
    const big = await luggages.create({ tripId: trip.id, name: 'Grande' })
    const bag = await luggages.create({ tripId: trip.id, name: 'Mochila' })
    await quantities.add({
      luggageId: big.id,
      itemId: socks.id,
      num: 5,
      nAlreadyPacked: 0,
    })
    const kept = await quantities.add({
      luggageId: bag.id,
      itemId: socks.id,
      num: 1,
      nAlreadyPacked: 0,
    })

    await luggages.remove(big.id)

    expect(await luggages.getById(big.id)).toBeUndefined()
    expect(await db.itemQuantities.toArray()).toEqual([kept])
  })
})
