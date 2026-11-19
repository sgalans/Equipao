import { Dexie } from 'dexie'
import { v7 as uuidv7 } from 'uuid'
import { describe, expect, it, onTestFinished } from 'vitest'
import { TEST_TIMESTAMP } from '@/test/db'
import { AppDb, SCHEMA_V1 } from './db'

/**
 * Test de migración: reproduce lo que pasará en el navegador de alguien que
 * ya usaba la app con el esquema v1 y abre la versión nueva.
 *   1. Crear una base de datos SOLO con la v1 (como la de tu navegador).
 *   2. Guardar datos con la forma antigua (sin compartmentId).
 *   3. Abrirla con AppDb actual → Dexie ejecuta upgrade() de la v2.
 *   4. Comprobar que los datos siguen ahí y con la forma nueva.
 */
describe('Migración v1 → v2 (compartimentos)', () => {
  it('conserva los datos y deja los artículos existentes como sueltos', async () => {
    const name = `test-migration-${uuidv7()}`
    const base = { createdAt: TEST_TIMESTAMP, updatedAt: TEST_TIMESTAMP }
    const luggageId = uuidv7()
    const itemId = uuidv7()
    const quantityId = uuidv7()

    // 1-2. Base de datos "antigua": una instancia de Dexie con solo la v1.
    const v1 = new Dexie(name)
    v1.version(1).stores(SCHEMA_V1)
    await v1.table('luggages').add({ id: luggageId, name: 'Grande', ...base })
    await v1.table('items').add({ id: itemId, name: 'Calcetines', ...base })
    await v1.table('itemQuantities').add({
      id: quantityId,
      luggageId,
      itemId,
      num: 5,
      nAlreadyPacked: 2,
      ...base,
      // Sin compartmentId: así eran las filas en la v1.
    })
    v1.close()

    // 3. La app nueva abre la misma base de datos → migra a la v2.
    const db = new AppDb(name)
    onTestFinished(() => db.delete())

    // 4. Datos intactos y con la forma nueva.
    expect(db.verno).toBe(2)
    expect(await db.luggages.get(luggageId)).toMatchObject({ name: 'Grande' })
    expect(await db.itemQuantities.get(quantityId)).toEqual({
      id: quantityId,
      luggageId,
      itemId,
      compartmentId: null, // ← lo ha puesto upgrade()
      num: 5,
      nAlreadyPacked: 2,
      ...base,
    })
    // La tabla nueva existe y está vacía.
    expect(await db.compartments.count()).toBe(0)
  })

  it('el índice nuevo compartmentId funciona tras migrar', async () => {
    const name = `test-migration-${uuidv7()}`
    const v1 = new Dexie(name)
    v1.version(1).stores(SCHEMA_V1)
    await v1.open()
    v1.close()

    const db = new AppDb(name)
    onTestFinished(() => db.delete())
    const compartmentId = uuidv7()
    await db.itemQuantities.add({
      id: uuidv7(),
      luggageId: uuidv7(),
      itemId: uuidv7(),
      compartmentId,
      num: 1,
      nAlreadyPacked: 0,
      createdAt: TEST_TIMESTAMP,
      updatedAt: TEST_TIMESTAMP,
    })

    expect(
      await db.itemQuantities
        .where('compartmentId')
        .equals(compartmentId)
        .count(),
    ).toBe(1)
  })
})
