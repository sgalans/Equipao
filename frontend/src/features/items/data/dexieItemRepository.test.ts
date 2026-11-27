import { describe, expect, it } from 'vitest'
import { ConsistencyError } from '@/shared/domain/errors'
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

  describe('remove (ON DELETE CASCADE)', () => {
    it('borra un artículo que no está en ninguna maleta', async () => {
      const { items } = createTestRepositories()
      const item = await items.create({ name: 'Cargador' })

      await items.remove(item.id)

      expect(await items.getById(item.id)).toBeUndefined()
    })

    it('borra un artículo en uso y lo quita de todas las maletas', async () => {
      const { items, luggages, quantities } = createTestRepositories()
      const socks = await items.create({ name: 'Calcetines' })
      const towel = await items.create({ name: 'Toalla' })
      const luggageIds: string[] = []
      for (const name of ['Grande', 'Mochila']) {
        const luggage = await luggages.create({ name })
        luggageIds.push(luggage.id)
        for (const item of [socks, towel]) {
          await quantities.add({
            luggageId: luggage.id,
            itemId: item.id,
            num: 1,
            nAlreadyPacked: 0,
          })
        }
      }

      await items.remove(socks.id)

      expect(await items.getById(socks.id)).toBeUndefined()
      // En cada maleta queda solo la toalla: nada huérfano, nada de más.
      for (const luggageId of luggageIds) {
        const left = await quantities.listByLuggage(luggageId)
        expect(left.map((q) => q.itemId)).toEqual([towel.id])
      }
    })

    it('es idempotente: borrar un artículo inexistente no falla', async () => {
      const { items } = createTestRepositories()

      await expect(
        items.remove('0190a0a0-0000-7000-8000-000000000000'),
      ).resolves.toBeUndefined()
    })
  })
})

describe('DexieItemRepository.update: sin duplicados en el catálogo', () => {
  it('no permite renombrar con el nombre de OTRO artículo (aunque cambien mayúsculas o tildes)', async () => {
    const { items } = createTestRepositories()
    await items.create({ name: 'Calcetines' })
    const typo = await items.create({ name: 'Calcetnes' })

    await expect(
      items.update(typo.id, { name: 'CALCETINES' }),
    ).rejects.toMatchObject({
      name: 'DuplicateError',
      message: 'Ya existe un artículo llamado «Calcetines»',
    })
    expect(await items.getById(typo.id)).toEqual(typo)
  })

  it('el MISMO artículo sí puede cambiar mayúsculas o tildes', async () => {
    const { items } = createTestRepositories()
    const camera = await items.create({ name: 'camara' })

    expect(await items.update(camera.id, { name: 'Cámara' })).toMatchObject({
      id: camera.id,
      name: 'Cámara',
    })
  })
})

describe('DexieItemRepository.listWithUsage', () => {
  it('añade a cada artículo las maletas donde está, en orden alfabético', async () => {
    const { items, luggages, quantities } = createTestRepositories()
    const socks = await items.create({ name: 'Calcetines' })
    const unused = await items.create({ name: 'Abrigo' })
    for (const name of ['Mochila', 'Grande']) {
      const luggage = await luggages.create({ name })
      await quantities.add({
        luggageId: luggage.id,
        itemId: socks.id,
        num: 1,
        nAlreadyPacked: 0,
      })
    }

    const summaries = await items.listWithUsage()

    expect(summaries).toEqual([
      { ...unused, luggageNames: [] },
      { ...socks, luggageNames: ['Grande', 'Mochila'] },
    ])
  })
})

describe('DexieItemRepository.findByName', () => {
  it('encuentra sin distinguir mayúsculas, tildes ni espacios', async () => {
    const { items } = createTestRepositories()
    const camera = await items.create({ name: 'Cámara' })

    expect(await items.findByName('  camara ')).toEqual(camera)
    expect(await items.findByName('CÁMARA')).toEqual(camera)
  })

  it('distingue la ñ (en español es otra letra)', async () => {
    const { items } = createTestRepositories()
    await items.create({ name: 'Paño' })

    expect(await items.findByName('Pano')).toBeUndefined()
  })

  it('devuelve undefined si no existe', async () => {
    const { items } = createTestRepositories()

    expect(await items.findByName('Toalla')).toBeUndefined()
  })
})

describe('DexieItemRepository.create: sin duplicados en el catálogo', () => {
  it('rechaza un nombre que ya existe (aunque cambien mayúsculas o tildes)', async () => {
    const { items } = createTestRepositories()
    await items.create({ name: 'Cámara' })

    await expect(items.create({ name: ' camara ' })).rejects.toMatchObject({
      name: 'DuplicateError',
      message: 'Ya existe un artículo llamado «Cámara»',
    })
    expect(await items.list()).toHaveLength(1)
  })
})

describe('DexieItemRepository.update: marcar como compartimento (opción A)', () => {
  it('sin usar, se puede convertir en compartimento y volver a artículo', async () => {
    const { items } = createTestRepositories()
    const bag = await items.create({ name: 'Mochila' })

    expect(
      (await items.update(bag.id, { isContainer: true })).isContainer,
    ).toBe(true)
    expect(
      (await items.update(bag.id, { isContainer: false })).isContainer,
    ).toBe(false)
  })

  it('si está en alguna maleta, no se puede cambiar (ConsistencyError) y no cambia nada', async () => {
    const { items, luggages, quantities } = createTestRepositories()
    const luggage = await luggages.create({ name: 'Grande' })
    const bag = await items.create({ name: 'Mochila' })
    await quantities.add({
      luggageId: luggage.id,
      itemId: bag.id,
      num: 1,
      nAlreadyPacked: 0,
    })

    await expect(items.update(bag.id, { isContainer: true })).rejects.toThrow(
      ConsistencyError,
    )
    expect((await items.getById(bag.id))?.isContainer).toBe(false)
    // Renombrar sigue funcionando aunque esté en uso.
    await expect(
      items.update(bag.id, { name: 'Mochila azul' }),
    ).resolves.toBeTruthy()
  })
})
