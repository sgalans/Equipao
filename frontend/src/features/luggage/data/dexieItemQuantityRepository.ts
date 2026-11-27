import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import {
  ConsistencyError,
  DuplicateError,
  EntityNotFoundError,
} from '@/shared/domain/errors'
import {
  ItemQuantitySchema,
  NewItemQuantitySchema,
  type ItemQuantity,
} from '../domain/itemQuantity'
import type { ItemQuantityRepository } from '../domain/itemQuantityRepository'
import { toggledPackedCount } from '../domain/packing'
import { lastPosition, positionAfter, positionsAfter } from '../domain/position'
import { loadQuantitiesOfOneLuggage } from './loadQuantities'
import {
  assertIsCompartmentOf,
  assertNotNested,
  containerItemIds,
} from './containers'
import { reorderRow } from './reorderRow'

type CountChanges = { num?: number; nAlreadyPacked?: number }

export function createDexieItemQuantityRepository(
  db: AppDb,
): ItemQuantityRepository {
  /**
   * Leer → calcular cambios → validar → guardar, todo en UNA transacción.
   * Así dos toques rápidos no se pisan (evita el "lost update": que ambos
   * lean el mismo valor y el segundo sobrescriba al primero).
   * `computeChanges` recibe la fila actual: cada operación solo define
   * CÓMO cambia, y este helper se encarga del resto (DRY).
   */
  function modify(
    id: string,
    computeChanges: (current: ItemQuantity) => CountChanges,
  ): Promise<ItemQuantity> {
    return db.transaction('rw', db.itemQuantities, async () => {
      const current = await db.itemQuantities.get(id)
      if (!current) throw new EntityNotFoundError('ItemQuantity', id)

      const changes = computeChanges(current)
      // Validamos la fila completa con los valores finales: así se aplican
      // los CHECK (p. ej. nAlreadyPacked <= num) a cualquier operación.
      const updated = ItemQuantitySchema.parse({
        ...current,
        num: changes.num ?? current.num,
        nAlreadyPacked: changes.nAlreadyPacked ?? current.nAlreadyPacked,
        updatedAt: nowIso(),
      })
      await db.itemQuantities.put(updated)
      return updated
    })
  }

  /** Invariante del compartimento (ver containers.ts). */
  function assertCompartmentBelongsTo(
    compartmentId: string | null,
    luggageId: string,
  ) {
    return assertIsCompartmentOf(db, compartmentId, luggageId)
  }

  // Orden = el del usuario (`position`, fractional indexing). sortBy compara
  // las claves como IndexedDB, por unidades de código: el orden correcto.
  // Solo ARTÍCULOS: las líneas contenedor son los compartimentos y las
  // gestiona su propio repositorio (el port de líneas no cambia).
  async function listByLuggage(luggageId: string) {
    const containers = await containerItemIds(db)
    const lines = await db.itemQuantities
      .where('luggageId')
      .equals(luggageId)
      .sortBy('position')
    return lines.filter((line) => !containers.has(line.itemId))
  }

  /** TODAS las líneas (también contenedores): para posiciones y unicidad. */
  function allLinesOf(luggageId: string) {
    return db.itemQuantities.where('luggageId').equals(luggageId).toArray()
  }

  /**
   * Lo común a addMany y addManyIntoNewCompartment: los artículos van a
   * `compartmentId` (un compartimento que YA existe, o null = sueltos) o,
   * si se indica `newContainerItemId`, dentro de la línea de ese contenedor
   * que se crea en esta misma transacción.
   */
  function insertMany(
    luggageId: string,
    itemIds: string[],
    compartmentId: string | null,
    newContainerItemId: string | null,
  ) {
    return db.transaction(
      'rw',
      [db.itemQuantities, db.luggages, db.items],
      async () => {
        // FOREIGN KEY (luggageId), invariante del compartimento y
        // FOREIGN KEY (itemId) de CADA artículo: si algo no existe es un
        // error (no se ignora en silencio) y no se añade nada.
        if (!(await db.luggages.get(luggageId))) {
          throw new EntityNotFoundError('Luggage', luggageId)
        }
        await assertCompartmentBelongsTo(compartmentId, luggageId)
        // Set: si llegara el mismo id dos veces, se trata una sola vez.
        const uniqueItemIds = [...new Set(itemIds)]
        const items = await db.items.bulkGet(uniqueItemIds)
        const missing = uniqueItemIds.find((_, index) => !items[index])
        if (missing) throw new EntityNotFoundError('Item', missing)
        const containers = new Set(
          items.flatMap((item) => (item?.isContainer ? [item.id] : [])),
        )

        // Lo que ya está en la maleta se salta (decisión de producto: ni
        // se vuelve a añadir ni se suma cantidad).
        const current = await allLinesOf(luggageId)
        const alreadyIn = new Set(current.map((q) => q.itemId))
        const toAdd = uniqueItemIds.filter((itemId) => !alreadyIn.has(itemId))

        // ids generados ANTES de crear las filas: así los artículos pueden
        // apuntar a la línea del contenedor nuevo (aún sin guardar).
        const bases = toAdd.map(() => newEntityBase())
        let destination = compartmentId
        if (newContainerItemId !== null) {
          const index = toAdd.indexOf(newContainerItemId)
          if (!containers.has(newContainerItemId) || index === -1) {
            throw new ConsistencyError(
              'El compartimento nuevo debe ser un contenedor que aún no esté en la maleta',
            )
          }
          destination = bases[index].id
        }

        // Todas al final, en el orden en que llegan.
        const positions = positionsAfter(lastPosition(current), toAdd.length)
        const added = toAdd.map((itemId, index) =>
          ItemQuantitySchema.parse({
            ...bases[index],
            luggageId,
            itemId,
            // Un contenedor es un compartimento: siempre de primer nivel.
            compartmentId: containers.has(itemId) ? null : destination,
            num: 1,
            nAlreadyPacked: 0,
            position: positions[index],
          }),
        )
        await db.itemQuantities.bulkAdd(added)
        return {
          added,
          skippedItemIds: uniqueItemIds.filter((itemId) =>
            alreadyIn.has(itemId),
          ),
        }
      },
    )
  }

  return {
    listByLuggage,

    async listEntriesByLuggage(luggageId) {
      // Dos consultas dentro de la misma función: useLiveQuery observa
      // ambas, así que la UI se refresca si cambia una cantidad O el nombre
      // de un artículo.
      const quantities = await listByLuggage(luggageId)
      // bulkGet: una sola consulta para todos los ids (no N consultas, el
      // clásico problema "N+1" de los ORM).
      const items = await db.items.bulkGet(quantities.map((q) => q.itemId))
      return quantities.map((quantity, index) => ({
        ...quantity,
        // RESTRICT impide borrar un ítem en uso, así que siempre debería
        // existir; el fallback evita romper la pantalla si no fuera así.
        itemName: items[index]?.name ?? '',
      }))
    },

    async add(input) {
      const data = NewItemQuantitySchema.parse(input)
      try {
        return await db.transaction(
          'rw',
          [db.itemQuantities, db.luggages, db.items],
          async () => {
            // FOREIGN KEY (luggageId) y FOREIGN KEY (itemId)
            if (!(await db.luggages.get(data.luggageId))) {
              throw new EntityNotFoundError('Luggage', data.luggageId)
            }
            if (!(await db.items.get(data.itemId))) {
              throw new EntityNotFoundError('Item', data.itemId)
            }
            await assertCompartmentBelongsTo(data.compartmentId, data.luggageId)
            await assertNotNested(db, [data.itemId], data.compartmentId)
            // Al final de la maleta (detrás de la última clave).
            const position = positionAfter(
              lastPosition(await allLinesOf(data.luggageId)),
            )
            const quantity = { ...newEntityBase(), ...data, position }
            await db.itemQuantities.add(quantity)
            return quantity
          },
        )
      } catch (error) {
        // El índice único [luggageId+itemId] hace que IndexedDB lance un
        // ConstraintError. Lo traducimos a un error de dominio para que la UI
        // no tenga que saber nada de Dexie (evitamos una leaky abstraction).
        if (error instanceof Error && error.name === 'ConstraintError') {
          throw new DuplicateError('Este ítem ya está en la maleta', {
            cause: error,
          })
        }
        throw error
      }
    },

    addMany(luggageId, itemIds, compartmentId = null) {
      return insertMany(luggageId, itemIds, compartmentId, null)
    },

    addManyIntoNewCompartment(luggageId, itemIds, containerItemId) {
      return insertMany(luggageId, itemIds, null, containerItemId)
    },

    togglePacked(id) {
      return modify(id, (current) => ({
        nAlreadyPacked: toggledPackedCount(current),
      }))
    },

    resize(id, num) {
      // Solo cambia la cantidad: `nAlreadyPacked` recuerda con cuántas se
      // marcó, así que deja de estar listo (suba o baje) y vuelve a estarlo
      // si se vuelve a esa cantidad (ver isFullyPacked).
      return modify(id, () => ({ num }))
    },

    reorder(id, beforeId, afterId) {
      return db.transaction('rw', db.itemQuantities, () =>
        reorderRow(db.itemQuantities, 'ItemQuantity', id, beforeId, afterId),
      )
    },

    place(id, compartmentId, beforeId, afterId) {
      return db.transaction('rw', [db.itemQuantities, db.items], async () => {
        const current = await db.itemQuantities.get(id)
        if (!current) throw new EntityNotFoundError('ItemQuantity', id)
        await assertCompartmentBelongsTo(compartmentId, current.luggageId)
        return reorderRow(
          db.itemQuantities,
          'ItemQuantity',
          id,
          beforeId,
          afterId,
          { compartmentId },
        )
      })
    },

    moveTo(id, compartmentId) {
      return db.transaction('rw', [db.itemQuantities, db.items], async () => {
        const current = await db.itemQuantities.get(id)
        if (!current) throw new EntityNotFoundError('ItemQuantity', id)
        await assertCompartmentBelongsTo(compartmentId, current.luggageId)

        const updated = { ...current, compartmentId, updatedAt: nowIso() }
        await db.itemQuantities.put(updated)
        return updated
      })
    },

    moveMany(ids, compartmentId) {
      return db.transaction('rw', [db.itemQuantities, db.items], async () => {
        const rows = await loadQuantitiesOfOneLuggage(db, ids)
        if (rows.length === 0) return []
        await assertCompartmentBelongsTo(compartmentId, rows[0].luggageId)
        const now = nowIso()
        const moved = rows.map((row) => ({
          ...row,
          compartmentId,
          updatedAt: now,
        }))
        await db.itemQuantities.bulkPut(moved)
        return moved
      })
    },

    async removeMany(ids) {
      await db.itemQuantities.bulkDelete(ids)
    },

    async remove(id) {
      await db.itemQuantities.delete(id)
    },
  }
}
