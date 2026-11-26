import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { mergedCounts } from '@/features/luggage/domain/packing'
import {
  ConsistencyError,
  DuplicateError,
  EntityNotFoundError,
} from '@/shared/domain/errors'
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

/** Mismo mensaje al crear y al renombrar: una sola definición. */
function duplicateNameError(existingName: string): DuplicateError {
  return new DuplicateError(`Ya existe un artículo llamado «${existingName}»`)
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

    create(input) {
      const item = { ...newEntityBase(), ...NewItemSchema.parse(input) }
      // Comprobar y crear en la misma transacción: la regla "sin duplicados
      // en el catálogo" se cumple venga de donde venga la petición (catálogo,
      // añadir por nombre…), no solo si la UI se acuerda de comprobarlo.
      return db.transaction('rw', db.items, async () => {
        const clash = findByNameIn(await db.items.toArray(), item.name)
        if (clash) throw duplicateNameError(clash.name)
        await db.items.add(item)
        return item
      })
    },

    update(id, changes) {
      return db.transaction('rw', [db.items, db.itemQuantities], async () => {
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
        if (clash && clash.id !== id) throw duplicateNameError(clash.name)
        // Convertir en compartimento (o al revés) solo si no está en ninguna
        // maleta (decisión del usuario, opción A): si no, habría que
        // reorganizarlas (sacar lo de dentro, sacarlo de otro compartimento…)
        // sin que se vea. La UI lo explica; aquí se garantiza.
        if (updated.isContainer !== current.isContainer) {
          const inUse = await db.itemQuantities
            .where('itemId')
            .equals(id)
            .count()
          if (inUse > 0) {
            throw new ConsistencyError(
              'Solo se puede cambiar si no está en ninguna maleta',
            )
          }
        }
        await db.items.put(updated)
        return updated
      })
    },

    merge(sourceId, targetId) {
      return db.transaction('rw', [db.items, db.itemQuantities], async () => {
        const [source, target] = await db.items.bulkGet([sourceId, targetId])
        if (!source) throw new EntityNotFoundError('Item', sourceId)
        if (!target) throw new EntityNotFoundError('Item', targetId)
        if (source.id === target.id) return target
        if (source.isContainer !== target.isContainer) {
          throw new ConsistencyError(
            'No se puede unir un artículo con un compartimento',
          )
        }
        const now = nowIso()
        const sourceLines = await db.itemQuantities
          .where('itemId')
          .equals(sourceId)
          .toArray()
        for (const line of sourceLines) {
          // ¿Esta maleta ya tenía el artículo destino? (UNIQUE luggage+item)
          const existing = await db.itemQuantities
            .where('[luggageId+itemId]')
            .equals([line.luggageId, targetId])
            .first()
          if (!existing) {
            await db.itemQuantities.update(line.id, {
              itemId: targetId,
              updatedAt: now,
            })
            continue
          }
          // Tenía los dos: una sola línea (la del destino, en su sitio).
          await db.itemQuantities.update(existing.id, {
            ...mergedCounts(existing, line),
            updatedAt: now,
          })
          // Si eran compartimentos, lo de dentro pasa al que se queda.
          await db.itemQuantities
            .where('compartmentId')
            .equals(line.id)
            .modify({ compartmentId: existing.id, updatedAt: now })
          await db.itemQuantities.delete(line.id)
        }
        await db.items.delete(sourceId)
        return target
      })
    },

    remove(id) {
      // ON DELETE CASCADE a mano (decisión de producto: limpiar el catálogo
      // no debe obligar a ir maleta por maleta). Hijos primero y después el
      // artículo, en una transacción: o se borra todo o nada.
      return db.transaction('rw', [db.items, db.itemQuantities], async () => {
        const lines = await db.itemQuantities
          .where('itemId')
          .equals(id)
          .toArray()
        // Si es un CONTENEDOR, sus líneas son compartimentos: lo que llevaban
        // dentro pasa a suelto (ON DELETE SET NULL), no se queda apuntando a
        // una línea que ya no existe.
        const lineIds = lines.map((line) => line.id)
        if (lineIds.length > 0) {
          await db.itemQuantities
            .where('compartmentId')
            .anyOf(lineIds)
            .modify({ compartmentId: null, updatedAt: nowIso() })
        }
        await db.itemQuantities.bulkDelete(lineIds)
        await db.items.delete(id)
      })
    },
  }
}
