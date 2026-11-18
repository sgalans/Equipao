import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { EntityNotFoundError } from '@/shared/domain/errors'
import { LuggageSchema, NewLuggageSchema } from '../domain/luggage'
import type { LuggageRepository } from '../domain/luggageRepository'

/**
 * Adapter: implementación de LuggageRepository sobre Dexie.
 *
 * Patrón factory: la función recibe sus dependencias (la base de datos) y
 * devuelve un objeto que cumple la interfaz. Es inyección de dependencias sin
 * framework: la app le pasa `db` y los tests una base de datos aislada.
 */
export function createDexieLuggageRepository(db: AppDb): LuggageRepository {
  return {
    list() {
      // Índice createdAt + reverse(): la maleta recién creada sale arriba,
      // justo debajo del campo donde se acaba de escribir su nombre.
      return db.luggages.orderBy('createdAt').reverse().toArray()
    },

    getById(id) {
      return db.luggages.get(id)
    },

    async create(input) {
      // parse() valida (lanza ZodError) y normaliza (recorta el nombre).
      const luggage = { ...newEntityBase(), ...NewLuggageSchema.parse(input) }
      await db.luggages.add(luggage)
      return luggage
    },

    update(id, changes) {
      // Leer + escribir en una transacción: nadie puede modificar la maleta
      // entre que la leemos y la guardamos.
      return db.transaction('rw', db.luggages, async () => {
        const current = await db.luggages.get(id)
        if (!current) throw new EntityNotFoundError('Luggage', id)

        const updated = LuggageSchema.parse({
          ...current,
          // Solo copiamos el campo permitido (no un spread de `changes`).
          name: changes.name ?? current.name,
          updatedAt: nowIso(),
        })
        await db.luggages.put(updated)
        return updated
      })
    },

    remove(id) {
      // ON DELETE CASCADE a mano (IndexedDB no tiene claves foráneas): hijos
      // primero y luego el padre, todo en una transacción para que nunca
      // queden ItemQuantity huérfanas si algo falla a medias.
      return db.transaction(
        'rw',
        [db.luggages, db.itemQuantities],
        async () => {
          await db.itemQuantities.where('luggageId').equals(id).delete()
          await db.luggages.delete(id)
        },
      )
    },
  }
}
