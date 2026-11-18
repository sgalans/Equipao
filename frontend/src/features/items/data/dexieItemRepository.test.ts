import { describe, expect, it } from 'vitest'
import { InUseError } from '@/shared/domain/errors'
import { createTestRepositories } from '@/test/repositories'

describe('DexieItemRepository', () => {
  it('list ordena alfabéticamente en español (sin distinguir mayúsculas ni tildes)', async () => {
    const { items } = createTestRepositories()
    for (const name of [
      'Zapatos',
      'Ñandú de peluche',
      'abrigo',
      'Neceser',
      'Álbum',
    ]) {
      await items.create({ name, color: '#000000' })
    }

    const names = (await items.list()).map((i) => i.name)

    // Con el orden de IndexedDB (código Unicode) saldría:
    // Neceser, Zapatos, abrigo, Ñandú…, Álbum
    expect(names).toEqual([
      'abrigo',
      'Álbum',
      'Neceser',
      'Ñandú de peluche',
      'Zapatos',
    ])
  })

  it('update cambia el color normalizándolo', async () => {
    const { items } = createTestRepositories()
    const item = await items.create({ name: 'Cargador', color: '#000000' })

    const updated = await items.update(item.id, { color: '#FFAA00' })

    expect(updated.color).toBe('#ffaa00')
  })

  describe('remove (ON DELETE RESTRICT)', () => {
    it('borra un ítem que no está en ninguna maleta', async () => {
      const { items } = createTestRepositories()
      const item = await items.create({ name: 'Cargador', color: '#000000' })

      await items.remove(item.id)

      expect(await items.getById(item.id)).toBeUndefined()
    })

    it('impide borrar un ítem en uso e indica en cuántas maletas está', async () => {
      const { items, trips, luggages, quantities } = createTestRepositories()
      const socks = await items.create({ name: 'Calcetines', color: '#3366ff' })
      const trip = await trips.create({
        name: 'Japón',
        startDate: '2027-04-01',
        endDate: '2027-04-15',
      })
      for (const name of ['Grande', 'Mochila']) {
        const luggage = await luggages.create({ tripId: trip.id, name })
        await quantities.add({
          luggageId: luggage.id,
          itemId: socks.id,
          num: 1,
          nAlreadyPacked: 0,
        })
      }

      const error = await items.remove(socks.id).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(InUseError)
      expect(error).toMatchObject({ usages: 2 })
      expect(await items.getById(socks.id)).toEqual(socks)
    })
  })
})
