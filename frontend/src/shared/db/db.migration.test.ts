import { Dexie } from 'dexie'
import { v7 as uuidv7 } from 'uuid'
import { describe, expect, it, onTestFinished } from 'vitest'
import { TEST_TIMESTAMP } from '@/test/db'
import { AppDb, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4 } from './db'

/**
 * Test de migración: reproduce lo que pasará en el navegador de alguien que
 * ya usaba la app con el esquema v1 y abre la versión nueva.
 *   1. Crear una base de datos SOLO con la v1 (como la de tu navegador).
 *   2. Guardar datos con la forma antigua (sin compartmentId).
 *   3. Abrirla con AppDb actual → Dexie ejecuta upgrade() de la v2.
 *   4. Comprobar que los datos siguen ahí y con la forma nueva.
 */
describe('Migración v1 → actual (cadena completa v1 → v2 → v3 → v4 → v5)', () => {
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

    // 3. La app nueva abre la misma base de datos → migra v1 → … → v4.
    const db = new AppDb(name)
    onTestFinished(() => db.delete())

    // 4. Datos intactos y con la forma nueva.
    expect(db.verno).toBe(5)
    expect(await db.luggages.get(luggageId)).toMatchObject({
      name: 'Grande',
      description: '', // ← v3
    })
    expect(await db.itemQuantities.get(quantityId)).toEqual({
      id: quantityId,
      luggageId,
      itemId,
      compartmentId: null, // ← lo ha puesto upgrade() de la v2
      num: 5,
      nAlreadyPacked: 2,
      position: expect.any(String), // ← v4
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
      position: 'a0',
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

describe('Migración v2 → v3 (descripción y compartimentos "listos")', () => {
  it('añade description vacía a las maletas e isReady = false a los compartimentos', async () => {
    const name = `test-migration-${uuidv7()}`
    const base = { createdAt: TEST_TIMESTAMP, updatedAt: TEST_TIMESTAMP }
    const luggageId = uuidv7()
    const compartmentId = uuidv7()

    // Base de datos en la v2, como la de quien ya usaba compartimentos.
    const v2 = new Dexie(name)
    v2.version(1).stores(SCHEMA_V1)
    v2.version(2).stores(SCHEMA_V2)
    await v2.table('luggages').add({ id: luggageId, name: 'Grande', ...base })
    await v2
      .table('compartments')
      .add({ id: compartmentId, luggageId, name: 'Neceser', ...base })
    v2.close()

    const db = new AppDb(name)
    onTestFinished(() => db.delete())

    expect(db.verno).toBe(5)
    expect(await db.luggages.get(luggageId)).toEqual({
      id: luggageId,
      name: 'Grande',
      description: '',
      ...base,
    })
    expect(await db.compartments.get(compartmentId)).toEqual({
      id: compartmentId,
      luggageId,
      name: 'Neceser',
      isReady: false,
      position: expect.any(String), // ← v5
      ...base,
    })
  })
})

describe('Migración v3 → v4 (orden manual: position)', () => {
  it('da a cada línea una posición que conserva el orden de añadido de SU maleta', async () => {
    const name = `test-migration-${uuidv7()}`
    const at = (second: number) =>
      `2026-01-01T00:00:${String(second).padStart(2, '0')}.000Z`
    const [big, small, itemA, itemB, itemC] = [1, 2, 3, 4, 5].map(() =>
      uuidv7(),
    )
    const line = (luggageId: string, itemId: string, second: number) => ({
      id: uuidv7(),
      luggageId,
      itemId,
      compartmentId: null,
      num: 1,
      nAlreadyPacked: 0,
      createdAt: at(second),
      updatedAt: at(second),
    })
    // Guardadas DESORDENADAS a propósito: el orden debe salir de createdAt.
    const rows = [
      line(big, itemB, 20),
      line(small, itemA, 5),
      line(big, itemA, 10),
      line(big, itemC, 30),
    ]

    const v3 = new Dexie(name)
    v3.version(1).stores(SCHEMA_V1)
    v3.version(2).stores(SCHEMA_V2)
    v3.version(3).stores(SCHEMA_V3)
    await v3.table('itemQuantities').bulkAdd(rows)
    v3.close()

    const db = new AppDb(name)
    onTestFinished(() => db.delete())

    expect(db.verno).toBe(5)
    const bigInOrder = await db.itemQuantities
      .where('luggageId')
      .equals(big)
      .sortBy('position')
    expect(bigInOrder.map((row) => row.itemId)).toEqual([itemA, itemB, itemC])
    const all = await db.itemQuantities.toArray()
    expect(all.every((row) => typeof row.position === 'string')).toBe(true)
    expect(
      (await db.itemQuantities.where('luggageId').equals(small).toArray())[0]
        .position,
    ).toEqual(expect.any(String))
  })
})

describe('Migración v4 → v5 (orden manual de compartimentos)', () => {
  it('da a cada compartimento una posición en el orden de añadido de SU maleta', async () => {
    const name = `test-migration-${uuidv7()}`
    const at = (second: number) =>
      `2026-01-01T00:00:${String(second).padStart(2, '0')}.000Z`
    const luggageId = uuidv7()
    const compartment = (label: string, second: number) => ({
      id: uuidv7(),
      luggageId,
      name: label,
      isReady: false,
      createdAt: at(second),
      updatedAt: at(second),
    })

    const v4 = new Dexie(name)
    v4.version(1).stores(SCHEMA_V1)
    v4.version(2).stores(SCHEMA_V2)
    v4.version(3).stores(SCHEMA_V3)
    v4.version(4).stores(SCHEMA_V4)
    // Desordenados a propósito: el orden debe salir de createdAt.
    await v4
      .table('compartments')
      .bulkAdd([
        compartment('Mochila', 20),
        compartment('Neceser', 10),
        compartment('Bolsa', 30),
      ])
    v4.close()

    const db = new AppDb(name)
    onTestFinished(() => db.delete())

    expect(db.verno).toBe(5)
    const inOrder = await db.compartments
      .where('luggageId')
      .equals(luggageId)
      .sortBy('position')
    expect(inOrder.map((c) => c.name)).toEqual(['Neceser', 'Mochila', 'Bolsa'])
  })
})
