import { Dexie } from 'dexie'
import { v7 as uuidv7 } from 'uuid'
import { describe, expect, it, onTestFinished } from 'vitest'
import { TEST_TIMESTAMP } from '@/test/db'
import {
  AppDb,
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3,
  SCHEMA_V4,
  SCHEMA_V5,
} from './db'

/**
 * Tests de migración: reproducen lo que pasará en el navegador de alguien que
 * ya usaba la app con un esquema antiguo y abre la versión nueva.
 *   1. Crear una base de datos SOLO con las versiones antiguas.
 *   2. Guardar datos con la forma antigua.
 *   3. Abrirla con AppDb actual → Dexie ejecuta los upgrade() pendientes.
 *   4. Comprobar que los datos siguen ahí y con la forma ACTUAL.
 */

const CURRENT_VERSION = 7
const SCHEMAS = [SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5]
const base = { createdAt: TEST_TIMESTAMP, updatedAt: TEST_TIMESTAMP }
const at = (second: number) =>
  `2026-01-01T00:00:${String(second).padStart(2, '0')}.000Z`

/** Base de datos "antigua" hasta la versión `version` (1–5). */
function oldDb(name: string, version: number): Dexie {
  const db = new Dexie(name)
  SCHEMAS.slice(0, version).forEach((schema, index) =>
    db.version(index + 1).stores(schema),
  )
  return db
}

/** Abre con la versión actual (migra) y la borra al acabar el test. */
function openCurrent(name: string): AppDb {
  const db = new AppDb(name)
  onTestFinished(() => db.delete())
  return db
}

describe('Migración v1 → actual (cadena completa)', () => {
  it('conserva los datos y deja los artículos existentes como sueltos', async () => {
    const name = `test-migration-${uuidv7()}`
    const luggageId = uuidv7()
    const itemId = uuidv7()
    const quantityId = uuidv7()

    const v1 = oldDb(name, 1)
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

    const db = openCurrent(name)

    expect(db.verno).toBe(CURRENT_VERSION)
    expect(await db.luggages.get(luggageId)).toMatchObject({
      name: 'Grande',
      description: '', // ← v3
    })
    expect(await db.itemQuantities.get(quantityId)).toEqual({
      id: quantityId,
      luggageId,
      itemId,
      compartmentId: null, // ← v2
      num: 5,
      nAlreadyPacked: 2,
      position: expect.any(String), // ← v4
      ...base,
    })
    expect(await db.items.get(itemId)).toMatchObject({
      isContainer: false, // ← v6
    })
    // La tabla de compartimentos ya no existe (← v7).
    expect(db.tables.map((table) => table.name)).not.toContain('compartments')
  })

  it('el índice compartmentId funciona tras migrar', async () => {
    const name = `test-migration-${uuidv7()}`
    const v1 = oldDb(name, 1)
    await v1.open()
    v1.close()

    const db = openCurrent(name)
    const compartmentId = uuidv7()
    await db.itemQuantities.add({
      id: uuidv7(),
      luggageId: uuidv7(),
      itemId: uuidv7(),
      compartmentId,
      num: 1,
      nAlreadyPacked: 0,
      position: 'a0',
      ...base,
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
  it('description vacía; el compartimento (sin "listo") acaba como línea contenedor sin guardar', async () => {
    const name = `test-migration-${uuidv7()}`
    const luggageId = uuidv7()
    const compartmentId = uuidv7()

    const v2 = oldDb(name, 2)
    await v2.table('luggages').add({ id: luggageId, name: 'Grande', ...base })
    await v2
      .table('compartments')
      .add({ id: compartmentId, luggageId, name: 'Neceser', ...base })
    v2.close()

    const db = openCurrent(name)

    expect(await db.luggages.get(luggageId)).toEqual({
      id: luggageId,
      name: 'Grande',
      description: '',
      ...base,
    })
    expect(await db.itemQuantities.get(compartmentId)).toMatchObject({
      luggageId,
      compartmentId: null,
      num: 1,
      nAlreadyPacked: 0, // ← isReady = false (v3)
    })
  })
})

describe('Migración v3 → v4 (orden manual: position)', () => {
  it('da a cada línea una posición que conserva el orden de añadido de SU maleta', async () => {
    const name = `test-migration-${uuidv7()}`
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

    const v3 = oldDb(name, 3)
    // Guardadas DESORDENADAS a propósito: el orden debe salir de createdAt.
    await v3
      .table('itemQuantities')
      .bulkAdd([
        line(big, itemB, 20),
        line(small, itemA, 5),
        line(big, itemA, 10),
        line(big, itemC, 30),
      ])
    v3.close()

    const db = openCurrent(name)

    const bigInOrder = await db.itemQuantities
      .where('luggageId')
      .equals(big)
      .sortBy('position')
    expect(bigInOrder.map((row) => row.itemId)).toEqual([itemA, itemB, itemC])
    const all = await db.itemQuantities.toArray()
    expect(all.every((row) => typeof row.position === 'string')).toBe(true)
  })
})

describe('Migración v4 → v5 (orden manual de compartimentos)', () => {
  it('los compartimentos conservan su orden de añadido (ya como líneas contenedor)', async () => {
    const name = `test-migration-${uuidv7()}`
    const luggageId = uuidv7()
    const compartment = (label: string, second: number) => ({
      id: uuidv7(),
      luggageId,
      name: label,
      isReady: false,
      createdAt: at(second),
      updatedAt: at(second),
    })

    const v4 = oldDb(name, 4)
    // Desordenados a propósito: el orden debe salir de createdAt.
    await v4
      .table('compartments')
      .bulkAdd([
        compartment('Mochila', 20),
        compartment('Neceser', 10),
        compartment('Bolsa', 30),
      ])
    v4.close()

    const db = openCurrent(name)

    const lines = await db.itemQuantities
      .where('luggageId')
      .equals(luggageId)
      .sortBy('position')
    const items = await db.items.bulkGet(lines.map((line) => line.itemId))
    expect(items.map((item) => item?.name)).toEqual([
      'Neceser',
      'Mochila',
      'Bolsa',
    ])
  })
})

describe('Migración v5 → v6 (compartimentos → líneas contenedor)', () => {
  /** Base de datos v5 con lo que cada test necesite. */
  async function v5With(
    name: string,
    data: { items?: object[]; compartments?: object[]; lines?: object[] },
  ) {
    const v5 = oldDb(name, 5)
    await v5.table('items').bulkAdd(data.items ?? [])
    await v5.table('compartments').bulkAdd(data.compartments ?? [])
    await v5.table('itemQuantities').bulkAdd(data.lines ?? [])
    v5.close()
  }
  const compartment = (
    luggageId: string,
    label: string,
    second: number,
    extra: object = {},
  ) => ({
    id: uuidv7(),
    luggageId,
    name: label,
    isReady: false,
    position: `a${second}`,
    createdAt: at(second),
    updatedAt: at(second),
    ...extra,
  })
  const line = (
    luggageId: string,
    itemId: string,
    compartmentId: string | null,
  ) => ({
    id: uuidv7(),
    luggageId,
    itemId,
    compartmentId,
    num: 1,
    nAlreadyPacked: 0,
    position: 'a0',
    ...base,
  })

  it('cada compartimento es una línea con SU MISMO id; sus artículos siguen dentro y el "listo" pasa a la línea', async () => {
    const name = `test-migration-${uuidv7()}`
    const [luggageId, brushId] = [uuidv7(), uuidv7()]
    const kit = compartment(luggageId, 'Neceser', 10, { isReady: true })
    const brush = line(luggageId, brushId, kit.id)
    await v5With(name, {
      items: [{ id: brushId, name: 'Cepillo', ...base }],
      compartments: [kit],
      lines: [brush],
    })

    const db = openCurrent(name)

    const container = await db.itemQuantities.get(kit.id)
    expect(container).toMatchObject({
      luggageId,
      compartmentId: null,
      num: 1,
      nAlreadyPacked: 1, // ← estaba "listo"
      position: kit.position,
    })
    expect(await db.items.get(container!.itemId)).toMatchObject({
      name: 'Neceser',
      isContainer: true,
    })
    // El artículo no se toca: sigue apuntando al mismo id.
    expect(await db.itemQuantities.get(brush.id)).toMatchObject({
      compartmentId: kit.id,
    })
  })

  it('el mismo nombre en varias maletas es UN contenedor del catálogo ("Neceser" = "neceser")', async () => {
    const name = `test-migration-${uuidv7()}`
    const [a, b] = [uuidv7(), uuidv7()]
    const kitA = compartment(a, 'Neceser', 10)
    const kitB = compartment(b, 'neceser', 20)
    await v5With(name, { compartments: [kitA, kitB] })

    const db = openCurrent(name)

    const [lineA, lineB] = await db.itemQuantities.bulkGet([kitA.id, kitB.id])
    expect(lineA!.itemId).toBe(lineB!.itemId)
    expect((await db.items.toArray()).map((item) => item.name)).toEqual([
      'Neceser',
    ])
  })

  it('dos compartimentos con el mismo nombre en una maleta se FUSIONAN (un Neceser por maleta)', async () => {
    const name = `test-migration-${uuidv7()}`
    const [luggageId, brushId] = [uuidv7(), uuidv7()]
    const first = compartment(luggageId, 'Neceser', 10)
    const second = compartment(luggageId, 'NECESER', 20)
    const brush = line(luggageId, brushId, second.id)
    await v5With(name, {
      items: [{ id: brushId, name: 'Cepillo', ...base }],
      compartments: [first, second],
      lines: [brush],
    })

    const db = openCurrent(name)

    expect(await db.itemQuantities.get(second.id)).toBeUndefined()
    // El artículo del segundo pasa al primero.
    expect(await db.itemQuantities.get(brush.id)).toMatchObject({
      compartmentId: first.id,
    })
  })

  it('un artículo normal con el mismo nombre: sin usar se convierte; en uso, se crea «X (compartimento)»', async () => {
    const name = `test-migration-${uuidv7()}`
    const luggageId = uuidv7()
    const [unusedId, usedId] = [uuidv7(), uuidv7()]
    await v5With(name, {
      items: [
        { id: unusedId, name: 'Mochila', ...base },
        { id: usedId, name: 'Bolsa', ...base },
      ],
      compartments: [
        compartment(luggageId, 'Mochila', 10),
        compartment(luggageId, 'Bolsa', 20),
      ],
      lines: [line(luggageId, usedId, null)],
    })

    const db = openCurrent(name)

    expect(await db.items.get(unusedId)).toMatchObject({ isContainer: true })
    expect(await db.items.get(usedId)).toMatchObject({ isContainer: false })
    const containers = (await db.items.toArray()).filter((i) => i.isContainer)
    expect(containers.map((item) => item.name).sort()).toEqual([
      'Bolsa (compartimento)',
      'Mochila',
    ])
  })
})
