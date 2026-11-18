import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { InUseError, EntityNotFoundError } from '@/shared/domain/errors'
import { ItemSchema, NewItemSchema } from '../domain/item'
import type { ItemRepository } from '../domain/itemRepository'

// IndexedDB ordena por código Unicode ('Z' < 'a', 'Ñ' al final). Collator
// ordena como espera una persona: sin distinguir mayúsculas ni tildes.
// Se crea una vez y se reutiliza (crearlo en cada comparación es caro).
const spanishCollator = new Intl.Collator('es', { sensitivity: 'base' })

export function createDexieItemRepository(db: AppDb): ItemRepository {
  return {
    async list() {
      const items = await db.items.toArray()
      return items.sort((a, b) => spanishCollator.compare(a.name, b.name))
    },

    getById(id) {
      return db.items.get(id)
    },

    async create(input) {
      const item = { ...newEntityBase(), ...NewItemSchema.parse(input) }
      await db.items.add(item)
      return item
    },

    update(id, changes) {
      return db.transaction('rw', db.items, async () => {
        const current = await db.items.get(id)
        if (!current) throw new EntityNotFoundError('Item', id)

        const updated = ItemSchema.parse({
          ...current,
          ...changes,
          id: current.id,
          createdAt: current.createdAt,
          updatedAt: nowIso(),
        })
        await db.items.put(updated)
        return updated
      })
    },

    remove(id) {
      return db.transaction('rw', [db.items, db.itemQuantities], async () => {
        // ON DELETE RESTRICT: comprobar los usos y borrar en la misma
        // transacción, para que nadie añada el ítem a una maleta entremedias.
        const usages = await db.itemQuantities
          .where('itemId')
          .equals(id)
          .count()
        if (usages > 0) throw new InUseError('Item', id, usages)
        await db.items.delete(id)
      })
    },
  }
}
