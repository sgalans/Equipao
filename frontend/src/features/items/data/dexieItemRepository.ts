import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { DuplicateError, EntityNotFoundError } from '@/shared/domain/errors'
import { ItemSchema, NewItemSchema, type Item } from '../domain/item'
import type { ItemRepository } from '../domain/itemRepository'
import { compareItemNames, isSameItemName } from '../domain/itemName'

// IndexedDB ordena por código Unicode ('Z' < 'a', 'Ñ' al final): el orden y la
// comparación de nombres se hacen en memoria con el criterio del dominio.

const byName = (a: { name: string }, b: { name: string }) =>
  compareItemNames(a.name, b.name)

/**
 * Busca por nombre en una lista ya cargada, con el criterio único del
 * dominio (isSameItemName). Lo comparten findByName y la comprobación de
 * duplicados al renombrar.
 */
function findByNameIn(items: Item[], name: string): Item | undefined {
  return items.find((item) => isSameItemName(item.name, name))
}

export function createDexieItemRepository(db: AppDb): ItemRepository {
  return {
    async list() {
      return (await db.items.toArray()).sort(byName)
    },

    async listWithUsage() {
      // Tres consultas en total (no una por artículo: evita el N+1) y se
      // cruzan en memoria con Maps, búsqueda O(1) por id.
      const [items, quantities, luggages] = await Promise.all([
        db.items.toArray(),
        db.itemQuantities.toArray(),
        db.luggages.toArray(),
      ])
      const luggageNameById = new Map(luggages.map((l) => [l.id, l.name]))
      const luggageNamesByItem = new Map<string, string[]>()
      for (const quantity of quantities) {
        const name = luggageNameById.get(quantity.luggageId)
        if (name === undefined) continue
        const names = luggageNamesByItem.get(quantity.itemId) ?? []
        names.push(name)
        luggageNamesByItem.set(quantity.itemId, names)
      }
      return items.sort(byName).map((item) => ({
        ...item,
        luggageNames: (luggageNamesByItem.get(item.id) ?? []).sort(
          compareItemNames,
        ),
      }))
    },

    getById(id) {
      return db.items.get(id)
    },

    async findByName(name) {
      // Recorremos el catálogo en memoria: con cientos de artículos es
      // instantáneo. (Si creciera a decenas de miles, se guardaría un campo
      // normalizado e indexado; hoy sería optimización prematura.)
      return findByNameIn(await db.items.toArray(), name)
    },

    async create(input) {
      const item = { ...newEntityBase(), ...NewItemSchema.parse(input) }
      await db.items.add(item)
      return item
    },

    update(id, changes) {
      return db.transaction('rw', db.items, async () => {
        const items = await db.items.toArray()
        const current = items.find((item) => item.id === id)
        if (!current) throw new EntityNotFoundError('Item', id)

        const updated = ItemSchema.parse({
          ...current,
          ...changes,
          id: current.id,
          createdAt: current.createdAt,
          updatedAt: nowIso(),
        })
        // Sin duplicados en el catálogo: otro artículo con el mismo nombre
        // (con el criterio de findByName) lo impide. El MISMO artículo sí
        // puede cambiar mayúsculas o tildes ("calcetines" → "Calcetines").
        const clash = findByNameIn(items, updated.name)
        if (clash && clash.id !== id) {
          throw new DuplicateError(
            `Ya existe un artículo llamado «${clash.name}»`,
          )
        }
        await db.items.put(updated)
        return updated
      })
    },

    remove(id) {
      // ON DELETE CASCADE a mano (decisión de producto: limpiar el catálogo
      // no debe obligar a ir maleta por maleta). Hijos primero y después el
      // artículo, en una transacción: o se borra todo o nada.
      return db.transaction('rw', [db.items, db.itemQuantities], async () => {
        await db.itemQuantities.where('itemId').equals(id).delete()
        await db.items.delete(id)
      })
    },
  }
}
