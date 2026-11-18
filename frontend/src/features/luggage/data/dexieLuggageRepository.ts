import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { EntityNotFoundError } from '@/shared/domain/errors'
import { LuggageSchema, NewLuggageSchema } from '../domain/luggage'
import type { LuggageRepository } from '../domain/luggageRepository'
import { deleteLuggagesCascade } from './cascade'

export function createDexieLuggageRepository(db: AppDb): LuggageRepository {
  return {
    listByTrip(tripId) {
      // sortBy ordena en memoria: perfecto para las pocas maletas de un viaje.
      return db.luggages.where('tripId').equals(tripId).sortBy('createdAt')
    },

    getById(id) {
      return db.luggages.get(id)
    },

    create(input) {
      const data = NewLuggageSchema.parse(input)
      // La comprobación de la FK y el insert van en la misma transacción:
      // así nadie puede borrar el viaje entre la comprobación y el add.
      return db.transaction('rw', [db.luggages, db.trips], async () => {
        if (!(await db.trips.get(data.tripId))) {
          throw new EntityNotFoundError('Trip', data.tripId)
        }
        const luggage = { ...newEntityBase(), ...data }
        await db.luggages.add(luggage)
        return luggage
      })
    },

    update(id, changes) {
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
      return db.transaction('rw', [db.luggages, db.itemQuantities], () =>
        deleteLuggagesCascade(db, [id]),
      )
    },
  }
}
