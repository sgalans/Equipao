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
      await items.create({ name })
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

  it('update renombra el ítem normalizando el nombre', async () => {
    const { items } = createTestRepositories()
    const item = await items.create({ name: 'Cargador' })

    const updated = await items.update(item.id, { name: '  Cargador USB-C ' })

    expect(updated).toMatchObject({ id: item.id, name: 'Cargador USB-C' })
  })

  describe('remove (ON DELETE RESTRICT)', () => {
    it('borra un ítem que no está en ninguna maleta', async () => {
      const { items } = createTestRepositories()
      const item = await items.create({ name: 'Cargador' })

      await items.remove(item.id)

      expect(await items.getById(item.id)).toBeUndefined()
    })

    it('impide borrar un ítem en uso e indica en cuántas maletas está', async () => {
      const { items, luggages, quantities } = createTestRepositories()
      const socks = await items.create({ name: 'Calcetines' })
      for (const name of ['Grande', 'Mochila']) {
        const luggage = await luggages.create({ name })
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
