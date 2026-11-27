import { isSameItemName } from '@/features/items/domain/itemName'
import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { DuplicateError, EntityNotFoundError } from '@/shared/domain/errors'
import { NameSchema } from '@/shared/domain/schemas'
import {
  NewCompartmentSchema,
  type Compartment,
  type NewCompartment,
} from '../domain/compartment'
import type { CompartmentRepository } from '../domain/compartmentRepository'
import { lastPosition, positionAfter } from '../domain/position'
import { containerItemIds, toCompartment } from './containers'
import { loadQuantitiesOfOneLuggage } from './loadQuantities'
import { reorderRow } from './reorderRow'

/**
 * ADAPTER de compartimentos sobre LÍNEAS CONTENEDOR (refactor/compartments).
 * El PORT (CompartmentRepository) no cambia, así que la UI tampoco: es
 * justo lo que permiten los ports & adapters. Por dentro, un compartimento
 * es una línea de la maleta cuyo artículo del catálogo es un contenedor.
 */
export function createDexieCompartmentRepository(
  db: AppDb,
): CompartmentRepository {
  /** Líneas contenedor de una maleta, en su orden manual. */
  async function containerLines(luggageId: string) {
    const containers = await containerItemIds(db)
    const lines = await db.itemQuantities
      .where('luggageId')
      .equals(luggageId)
      .sortBy('position')
    return lines.filter((line) => containers.has(line.itemId))
  }

  /** Una línea contenedor como Compartment (con el nombre del catálogo). */
  async function load(id: string): Promise<Compartment> {
    const line = await db.itemQuantities.get(id)
    const item = line && (await db.items.get(line.itemId))
    if (!line || !item?.isContainer) {
      throw new EntityNotFoundError('Compartment', id)
    }
    return toCompartment(line, item.name)
  }

  async function listByLuggage(luggageId: string) {
    const lines = await containerLines(luggageId)
    const items = await db.items.bulkGet(lines.map((line) => line.itemId))
    return lines.map((line, index) =>
      toCompartment(line, items[index]?.name ?? ''),
    )
  }

  /**
   * Crea el compartimento: reutiliza el contenedor del catálogo con ese
   * nombre (o lo crea) y añade su línea al final de la maleta. Un
   * compartimento por maleta y contenedor (decisión del usuario).
   */
  async function insert(input: NewCompartment): Promise<Compartment> {
    const data = NewCompartmentSchema.parse(input)
    if (!(await db.luggages.get(data.luggageId))) {
      throw new EntityNotFoundError('Luggage', data.luggageId)
    }
    const catalog = await db.items.toArray()
    let container = catalog.find((item) => isSameItemName(item.name, data.name))
    if (container && !container.isContainer) {
      throw new DuplicateError(
        `Ya hay un artículo «${container.name}» que no es un compartimento`,
      )
    }
    if (!container) {
      container = { ...newEntityBase(), name: data.name, isContainer: true }
      await db.items.add(container)
    }
    const lines = await db.itemQuantities
      .where('luggageId')
      .equals(data.luggageId)
      .toArray()
    if (lines.some((line) => line.itemId === container.id)) {
      throw new DuplicateError(`Ya hay un «${container.name}» en esta maleta`)
    }
    const line = {
      ...newEntityBase(),
      luggageId: data.luggageId,
      itemId: container.id,
      compartmentId: null,
      num: 1,
      nAlreadyPacked: data.isReady ? 1 : 0,
      position: positionAfter(lastPosition(lines)),
    }
    await db.itemQuantities.add(line)
    return toCompartment(line, container.name)
  }

  const tables = [db.items, db.luggages, db.itemQuantities]

  return {
    listByLuggage(luggageId) {
      return db.transaction('r', [db.items, db.itemQuantities], () =>
        listByLuggage(luggageId),
      )
    },

    create(input) {
      return db.transaction('rw', tables, () => insert(input))
    },

    createWithQuantities(input, quantityIds) {
      // Crear el compartimento y mover los artículos en UNA transacción: si
      // algo falla no queda un compartimento vacío creado a medias.
      return db.transaction('rw', tables, async () => {
        const compartment = await insert(input)
        const rows = await loadQuantitiesOfOneLuggage(
          db,
          quantityIds,
          compartment.luggageId,
        )
        const now = nowIso()
        await db.itemQuantities.bulkPut(
          rows.map((row) => ({
            ...row,
            compartmentId: compartment.id,
            updatedAt: now,
          })),
        )
        return compartment
      })
    },

    reorder(id, beforeId, afterId) {
      return db.transaction('rw', [db.items, db.itemQuantities], async () => {
        await load(id)
        await reorderRow(
          db.itemQuantities,
          'Compartment',
          id,
          beforeId,
          afterId,
        )
        return load(id)
      })
    },

    toggleReady(id) {
      // "Listo" = la línea contenedor guardada (1 de 1). Leer + invertir +
      // guardar en una transacción: dos toques rápidos no se pisan.
      return db.transaction('rw', [db.items, db.itemQuantities], async () => {
        const current = await load(id)
        await db.itemQuantities.update(id, {
          nAlreadyPacked: current.isReady ? 0 : 1,
          updatedAt: nowIso(),
        })
        return load(id)
      })
    },

    update(id, changes) {
      // Renombrar = renombrar el CONTENEDOR del catálogo: cambia en todas las
      // maletas que lo usan (decisión del usuario: se comparten).
      return db.transaction('rw', [db.items, db.itemQuantities], async () => {
        const current = await load(id)
        if (changes.name === undefined) return current
        const name = NameSchema.parse(changes.name)
        const line = await db.itemQuantities.get(id)
        const catalog = await db.items.toArray()
        const clash = catalog.find(
          (item) => item.id !== line!.itemId && isSameItemName(item.name, name),
        )
        if (clash) {
          throw new DuplicateError(
            `Ya existe un artículo llamado «${clash.name}»`,
          )
        }
        await db.items.update(line!.itemId, { name, updatedAt: nowIso() })
        return load(id)
      })
    },

    remove(id) {
      // ON DELETE SET NULL a mano: sus artículos pasan a sueltos y después
      // se borra la línea contenedor (el contenedor sigue en el catálogo).
      // Todo en una transacción: nunca quedan artículos apuntando a un
      // compartimento que ya no existe. Idempotente.
      return db.transaction('rw', [db.items, db.itemQuantities], async () => {
        const line = await db.itemQuantities.get(id)
        // Solo una línea CONTENEDOR: nunca se borra un artículo por error.
        // Si no existe (o no lo es), no hay nada que hacer (idempotente).
        const item = line && (await db.items.get(line.itemId))
        if (!item?.isContainer) return
        await db.itemQuantities
          .where('compartmentId')
          .equals(id)
          .modify({ compartmentId: null, updatedAt: nowIso() })
        await db.itemQuantities.delete(id)
      })
    },
  }
}
