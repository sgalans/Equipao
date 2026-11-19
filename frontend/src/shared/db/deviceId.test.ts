import { validate, version } from 'uuid'
import { describe, expect, it } from 'vitest'
import { createTestDb } from '@/test/db'
import { AppDb } from './db'
import { getDeviceId } from './deviceId'

describe('getDeviceId', () => {
  it('genera un UUID v7 la primera vez', async () => {
    const db = createTestDb()

    const deviceId = await getDeviceId(db)

    expect(validate(deviceId)).toBe(true)
    expect(version(deviceId)).toBe(7)
  })

  it('devuelve siempre el mismo id en llamadas sucesivas', async () => {
    const db = createTestDb()

    const first = await getDeviceId(db)
    const second = await getDeviceId(db)

    expect(second).toBe(first)
  })

  it('persiste el id: sobrevive a cerrar y reabrir la base de datos', async () => {
    const db = createTestDb()
    const first = await getDeviceId(db)
    db.close()

    // Otra instancia con el mismo nombre = como recargar la página.
    const reopened = new AppDb(db.name)
    const afterReopen = await getDeviceId(reopened)
    reopened.close()

    expect(afterReopen).toBe(first)
  })

  it('no crea dos ids con llamadas simultáneas (gracias a la transacción)', async () => {
    const db = createTestDb()

    const ids = await Promise.all([
      getDeviceId(db),
      getDeviceId(db),
      getDeviceId(db),
    ])

    expect(new Set(ids).size).toBe(1)
    expect(await db.meta.count()).toBe(1)
  })
})
