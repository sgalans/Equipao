import { version } from 'uuid'
import { vi, describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { EntityNotFoundError } from '@/shared/domain/errors'
import { createTestRepositories, freezeTime } from '@/test/repositories'

const japan = { name: 'Japón', startDate: '2027-04-01', endDate: '2027-04-15' }

describe('DexieTripRepository', () => {
  describe('create', () => {
    it('asigna id UUID v7 y timestamps, y normaliza el input', async () => {
      freezeTime('2026-11-18T10:00:00.000Z')
      const { trips } = createTestRepositories()

      const trip = await trips.create({ ...japan, name: '  Japón ' })

      expect(version(trip.id)).toBe(7)
      expect(trip).toMatchObject({
        name: 'Japón',
        createdAt: '2026-11-18T10:00:00.000Z',
        updatedAt: '2026-11-18T10:00:00.000Z',
      })
      expect(await trips.getById(trip.id)).toEqual(trip)
    })

    it('rechaza un input inválido y no guarda nada', async () => {
      const { trips } = createTestRepositories()

      await expect(
        trips.create({ ...japan, endDate: '2027-03-01' }),
      ).rejects.toBeInstanceOf(ZodError)
      expect(await trips.list()).toEqual([])
    })
  })

  it('list devuelve los viajes ordenados por fecha de inicio', async () => {
    const { trips } = createTestRepositories()
    await trips.create({
      ...japan,
      name: 'Tercero',
      startDate: '2027-09-01',
      endDate: '2027-09-02',
    })
    await trips.create({
      ...japan,
      name: 'Primero',
      startDate: '2027-01-01',
      endDate: '2027-01-02',
    })
    await trips.create({
      ...japan,
      name: 'Segundo',
      startDate: '2027-05-01',
      endDate: '2027-05-02',
    })

    const names = (await trips.list()).map((t) => t.name)

    expect(names).toEqual(['Primero', 'Segundo', 'Tercero'])
  })

  describe('update', () => {
    it('cambia los campos y updatedAt, pero no id ni createdAt', async () => {
      freezeTime('2026-11-18T10:00:00.000Z')
      const { trips } = createTestRepositories()
      const trip = await trips.create(japan)

      vi.setSystemTime(new Date('2026-11-19T08:30:00.000Z'))
      const updated = await trips.update(trip.id, { name: 'Japón y Corea' })

      expect(updated).toEqual({
        ...trip,
        name: 'Japón y Corea',
        updatedAt: '2026-11-19T08:30:00.000Z',
      })
      expect(await trips.getById(trip.id)).toEqual(updated)
    })

    it('valida la regla de fechas con los valores fusionados', async () => {
      const { trips } = createTestRepositories()
      const trip = await trips.create(japan)

      // Solo cambia endDate, pero queda antes del startDate guardado.
      await expect(
        trips.update(trip.id, { endDate: '2027-03-01' }),
      ).rejects.toBeInstanceOf(ZodError)
      expect(await trips.getById(trip.id)).toEqual(trip)
    })

    it('lanza EntityNotFoundError si el viaje no existe', async () => {
      const { trips } = createTestRepositories()

      await expect(
        trips.update('0190a0a0-0000-7000-8000-000000000000', { name: 'X' }),
      ).rejects.toBeInstanceOf(EntityNotFoundError)
    })
  })

  describe('remove (ON DELETE CASCADE)', () => {
    it('borra el viaje, sus maletas y su contenido; respeta lo demás', async () => {
      const { db, trips, luggages, quantities, items } =
        createTestRepositories()
      const socks = await items.create({ name: 'Calcetines', color: '#3366ff' })

      // Viaje que vamos a borrar: 2 maletas con contenido.
      const trip = await trips.create(japan)
      const big = await luggages.create({ tripId: trip.id, name: 'Grande' })
      const bag = await luggages.create({ tripId: trip.id, name: 'Mochila' })
      await quantities.add({
        luggageId: big.id,
        itemId: socks.id,
        num: 5,
        nAlreadyPacked: 0,
      })
      await quantities.add({
        luggageId: bag.id,
        itemId: socks.id,
        num: 1,
        nAlreadyPacked: 0,
      })

      // Otro viaje que NO debe verse afectado.
      const other = await trips.create({ ...japan, name: 'Otro' })
      const otherBag = await luggages.create({
        tripId: other.id,
        name: 'Maleta',
      })
      await quantities.add({
        luggageId: otherBag.id,
        itemId: socks.id,
        num: 2,
        nAlreadyPacked: 0,
      })

      await trips.remove(trip.id)

      expect(await trips.getById(trip.id)).toBeUndefined()
      expect(await db.luggages.toArray()).toEqual([otherBag])
      expect(await db.itemQuantities.count()).toBe(1)
      // El catálogo no forma parte de la cascada.
      expect(await items.getById(socks.id)).toEqual(socks)
    })

    it('es idempotente: borrar un viaje inexistente no falla', async () => {
      const { trips } = createTestRepositories()

      await expect(
        trips.remove('0190a0a0-0000-7000-8000-000000000000'),
      ).resolves.toBeUndefined()
    })
  })
})
