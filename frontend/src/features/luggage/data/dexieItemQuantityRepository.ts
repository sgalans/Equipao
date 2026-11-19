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
import { packedCountAfterResize, toggledPackedCount } from '../domain/packing'

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

  /**
   * Invariante: un artículo solo puede ir en un compartimento de SU maleta.
   * IndexedDB no sabe expresar esta regla (no hay FOREIGN KEY compuestas ni
   * CHECK entre tablas), así que la comprobamos aquí. Debe llamarse dentro
   * de una transacción que incluya la tabla compartments.
   */
  async function assertCompartmentBelongsTo(
    compartmentId: string | null,
    luggageId: string,
  ) {
    if (compartmentId === null) return // suelto: siempre válido
    const compartment = await db.compartments.get(compartmentId)
    if (!compartment) {
      throw new EntityNotFoundError('Compartment', compartmentId)
    }
    if (compartment.luggageId !== luggageId) {
      throw new ConsistencyError('El compartimento pertenece a otra maleta')
    }
  }

  // Función local (no `this.listByLuggage`): `this` dentro de un objeto
  // literal se pierde si alguien desestructura el método, y fallaría.
  function listByLuggage(luggageId: string) {
    return db.itemQuantities
      .where('luggageId')
      .equals(luggageId)
      .sortBy('createdAt')
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
          [db.itemQuantities, db.luggages, db.items, db.compartments],
          async () => {
            // FOREIGN KEY (luggageId) y FOREIGN KEY (itemId)
            if (!(await db.luggages.get(data.luggageId))) {
              throw new EntityNotFoundError('Luggage', data.luggageId)
            }
            if (!(await db.items.get(data.itemId))) {
              throw new EntityNotFoundError('Item', data.itemId)
            }
            await assertCompartmentBelongsTo(data.compartmentId, data.luggageId)
            const quantity = { ...newEntityBase(), ...data }
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

    update(id, changes) {
      return modify(id, () => changes)
    },

    togglePacked(id) {
      return modify(id, (current) => ({
        nAlreadyPacked: toggledPackedCount(current),
      }))
    },

    resize(id, num) {
      return modify(id, (current) => ({
        num,
        nAlreadyPacked: packedCountAfterResize(current, num),
      }))
    },

    moveTo(id, compartmentId) {
      return db.transaction(
        'rw',
        [db.itemQuantities, db.compartments],
        async () => {
          const current = await db.itemQuantities.get(id)
          if (!current) throw new EntityNotFoundError('ItemQuantity', id)
          await assertCompartmentBelongsTo(compartmentId, current.luggageId)

          const updated = { ...current, compartmentId, updatedAt: nowIso() }
          await db.itemQuantities.put(updated)
          return updated
        },
      )
    },

    async remove(id) {
      await db.itemQuantities.delete(id)
    },
  }
}
