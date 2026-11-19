import { version } from 'uuid'
import { describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { EntityNotFoundError } from '@/shared/domain/errors'
import { createTestRepositories, freezeTime } from '@/test/repositories'

const MISSING_ID = '0190a0a0-0000-7000-8000-000000000000'

describe('DexieLuggageRepository', () => {
  describe('create', () => {
    it('asigna id UUID v7 y timestamps, y normaliza el nombre', async () => {
      freezeTime('2026-11-18T10:00:00.000Z')
      const { luggages } = createTestRepositories()

      const luggage = await luggages.create({ name: '  Mochila Japón ' })

      expect(version(luggage.id)).toBe(7)
      expect(luggage).toMatchObject({
        name: 'Mochila Japón',
        createdAt: '2026-11-18T10:00:00.000Z',
        updatedAt: '2026-11-18T10:00:00.000Z',
      })
      expect(await luggages.getById(luggage.id)).toEqual(luggage)
    })

    it('rechaza un nombre vacío y no guarda nada', async () => {
      const { luggages } = createTestRepositories()

      await expect(luggages.create({ name: '  ' })).rejects.toBeInstanceOf(
        ZodError,
      )
      expect(await luggages.list()).toEqual([])
    })
  })

  it('list devuelve las maletas más recientes primero', async () => {
    freezeTime('2026-11-18T10:00:00.000Z')
    const { luggages } = createTestRepositories()
    await luggages.create({ name: 'Primera' })
    vi.setSystemTime(new Date('2026-11-19T10:00:00.000Z'))
    await luggages.create({ name: 'Segunda' })

    const names = (await luggages.list()).map((l) => l.name)

    expect(names).toEqual(['Segunda', 'Primera'])
  })

  describe('update', () => {
    it('renombra y actualiza updatedAt, pero no id ni createdAt', async () => {
      freezeTime('2026-11-18T10:00:00.000Z')
      const { luggages } = createTestRepositories()
      const luggage = await luggages.create({ name: 'Grande' })

      vi.setSystemTime(new Date('2026-11-19T08:30:00.000Z'))
      const updated = await luggages.update(luggage.id, { name: 'Maleta roja' })

      expect(updated).toEqual({
        ...luggage,
        name: 'Maleta roja',
        updatedAt: '2026-11-19T08:30:00.000Z',
      })
    })

    it('lanza EntityNotFoundError si la maleta no existe', async () => {
      const { luggages } = createTestRepositories()

      await expect(
        luggages.update(MISSING_ID, { name: 'X' }),
      ).rejects.toBeInstanceOf(EntityNotFoundError)
    })
  })

  describe('remove (ON DELETE CASCADE)', () => {
    it('borra la maleta y su contenido; respeta otras maletas y el catálogo', async () => {
      const { db, luggages, quantities, items } = createTestRepositories()
      const socks = await items.create({ name: 'Calcetines' })
      const big = await luggages.create({ name: 'Grande' })
      const bag = await luggages.create({ name: 'Mochila' })
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
      // El catálogo no forma parte de la cascada.
      expect(await items.getById(socks.id)).toEqual(socks)
    })

    it('es idempotente: borrar una maleta inexistente no falla', async () => {
      const { luggages } = createTestRepositories()

      await expect(luggages.remove(MISSING_ID)).resolves.toBeUndefined()
    })
  })
})

describe('DexieLuggageRepository.listSummaries', () => {
  it('añade a cada maleta su progreso en artículos completos', async () => {
    freezeTime('2026-11-18T10:00:00.000Z')
    const { luggages, items, quantities } = createTestRepositories()
    const socks = await items.create({ name: 'Calcetines' })
    const passport = await items.create({ name: 'Pasaporte' })
    const big = await luggages.create({ name: 'Grande' })
    await quantities.add({
      luggageId: big.id,
      itemId: socks.id,
      num: 5,
      nAlreadyPacked: 5,
    })
    await quantities.add({
      luggageId: big.id,
      itemId: passport.id,
      num: 1,
      nAlreadyPacked: 0,
    })
    vi.setSystemTime(new Date('2026-11-19T10:00:00.000Z'))
    const empty = await luggages.create({ name: 'Vacía' })

    const summaries = await luggages.listSummaries()

    // Mismo orden que list() (más recientes primero) y sin mezclar maletas.
    expect(summaries).toEqual([
      { ...empty, done: 0, total: 0 },
      { ...big, done: 1, total: 2 },
    ])
  })
})

describe('DexieLuggageRepository.duplicate', () => {
  /** Maleta con un artículo suelto (guardado) y un compartimento con dos. */
  async function setupFullLuggage() {
    const repos = createTestRepositories()
    const source = await repos.luggages.create({ name: 'Mochila' })
    const kit = await repos.compartments.create({
      luggageId: source.id,
      name: 'Neceser',
    })
    const add = async (
      name: string,
      compartmentId: string | null,
      num: number,
      packed: number,
    ) => {
      const item = await repos.items.create({ name })
      return repos.quantities.add({
        luggageId: source.id,
        itemId: item.id,
        compartmentId,
        num,
        nAlreadyPacked: packed,
      })
    }
    await add('Pasaporte', null, 1, 1)
    await add('Cepillo', kit.id, 1, 1)
    await add('Calcetines', kit.id, 5, 2)
    return { ...repos, source, kit }
  }

  it('crea "Nombre (copia)" con los mismos artículos y cantidades, sin nada guardado', async () => {
    const { luggages, quantities, source } = await setupFullLuggage()

    const copy = await luggages.duplicate(source.id)

    expect(copy.name).toBe('Mochila (copia)')
    expect(copy.id).not.toBe(source.id)
    const copied = await quantities.listEntriesByLuggage(copy.id)
    // Mismo orden de añadido, mismas cantidades, todo a 0 guardado.
    expect(copied.map((e) => [e.itemName, e.num, e.nAlreadyPacked])).toEqual([
      ['Pasaporte', 1, 0],
      ['Cepillo', 1, 0],
      ['Calcetines', 5, 0],
    ])
  })

  it('copia los compartimentos y cada artículo apunta al compartimento de la COPIA', async () => {
    const { luggages, compartments, quantities, source, kit } =
      await setupFullLuggage()

    const copy = await luggages.duplicate(source.id)

    const [copiedKit] = await compartments.listByLuggage(copy.id)
    expect(copiedKit).toMatchObject({ name: 'Neceser', luggageId: copy.id })
    expect(copiedKit.id).not.toBe(kit.id)
    const copied = await quantities.listByLuggage(copy.id)
    expect(copied.map((q) => q.compartmentId)).toEqual([
      null,
      copiedKit.id,
      copiedKit.id,
    ])
  })

  it('no toca la maleta original ni el catálogo', async () => {
    const { luggages, quantities, compartments, items, source } =
      await setupFullLuggage()
    const before = {
      quantities: await quantities.listByLuggage(source.id),
      compartments: await compartments.listByLuggage(source.id),
      items: await items.list(),
    }

    await luggages.duplicate(source.id)

    expect(await quantities.listByLuggage(source.id)).toEqual(before.quantities)
    expect(await compartments.listByLuggage(source.id)).toEqual(
      before.compartments,
    )
    // Los artículos del catálogo se REUTILIZAN, no se duplican.
    expect(await items.list()).toEqual(before.items)
  })

  it('duplicar una copia da "(copia 2)"', async () => {
    const { luggages, source } = await setupFullLuggage()
    const copy = await luggages.duplicate(source.id)

    expect((await luggages.duplicate(copy.id)).name).toBe('Mochila (copia 2)')
  })

  it('lanza EntityNotFoundError si la maleta no existe', async () => {
    const { luggages } = createTestRepositories()

    await expect(luggages.duplicate(MISSING_ID)).rejects.toBeInstanceOf(
      EntityNotFoundError,
    )
  })
})

describe('Descripción y compartimentos "listos" en el repositorio de maletas', () => {
  it('update cambia la descripción sin tocar el nombre', async () => {
    const { luggages } = createTestRepositories()
    const luggage = await luggages.create({ name: 'Mochila' })

    const updated = await luggages.update(luggage.id, {
      description: 'Japón, 2 semanas',
    })

    expect(updated).toMatchObject({
      name: 'Mochila',
      description: 'Japón, 2 semanas',
    })
  })

  it('listSummaries cuenta por bloques: sueltos + compartimentos marcados', async () => {
    const { luggages, compartments, items, quantities } =
      createTestRepositories()
    const luggage = await luggages.create({ name: 'Grande' })
    const kit = await compartments.create({
      luggageId: luggage.id,
      name: 'Neceser',
    })
    await compartments.create({ luggageId: luggage.id, name: 'Mochila' })
    const passport = await items.create({ name: 'Pasaporte' })
    await quantities.add({
      luggageId: luggage.id,
      itemId: passport.id,
      num: 1,
      nAlreadyPacked: 1,
    })
    await compartments.toggleReady(kit.id)

    const [summary] = await luggages.listSummaries()

    // Pasaporte (listo) + Neceser (marcado) + Mochila (sin marcar): 2 de 3.
    expect(summary).toMatchObject({ done: 2, total: 3 })
  })

  it('duplicate copia la descripción y deja los compartimentos sin marcar', async () => {
    const { luggages, compartments } = createTestRepositories()
    const source = await luggages.create({
      name: 'Mochila',
      description: 'Plantilla de finde',
    })
    const kit = await compartments.create({
      luggageId: source.id,
      name: 'Neceser',
    })
    await compartments.toggleReady(kit.id)

    const copy = await luggages.duplicate(source.id)

    expect(copy.description).toBe('Plantilla de finde')
    const [copiedKit] = await compartments.listByLuggage(copy.id)
    expect(copiedKit.isReady).toBe(false)
  })
})
