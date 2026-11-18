import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { DuplicateError, EntityNotFoundError } from '@/shared/domain/errors'
import {
  ItemQuantitySchema,
  NewItemQuantitySchema,
} from '../domain/itemQuantity'
import type { ItemQuantityRepository } from '../domain/itemQuantityRepository'

export function createDexieItemQuantityRepository(
  db: AppDb,
): ItemQuantityRepository {
  return {
    listByLuggage(luggageId) {
      return db.itemQuantities
        .where('luggageId')
        .equals(luggageId)
        .sortBy('createdAt')
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
      return db.transaction('rw', db.itemQuantities, async () => {
        const current = await db.itemQuantities.get(id)
        if (!current) throw new EntityNotFoundError('ItemQuantity', id)

        // Validamos la fila completa con los valores finales: bajar `num` por
        // debajo de lo ya empaquetado viola CHECK (nAlreadyPacked <= num).
        const updated = ItemQuantitySchema.parse({
          ...current,
          num: changes.num ?? current.num,
          nAlreadyPacked: changes.nAlreadyPacked ?? current.nAlreadyPacked,
          updatedAt: nowIso(),
        })
        await db.itemQuantities.put(updated)
        return updated
      })
    },

    async remove(id) {
      await db.itemQuantities.delete(id)
    },
  }
}
