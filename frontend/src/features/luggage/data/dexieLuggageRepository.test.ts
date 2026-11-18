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
