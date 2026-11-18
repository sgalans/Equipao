import { deleteLuggagesCascade } from '@/features/luggage/data/cascade'
import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { EntityNotFoundError } from '@/shared/domain/errors'
import { NewTripSchema, TripSchema } from '../domain/trip'
import type { TripRepository } from '../domain/tripRepository'

/**
 * Adapter: implementación de TripRepository sobre Dexie.
 *
 * Patrón factory: la función recibe sus dependencias (la base de datos) y
 * devuelve un objeto que cumple la interfaz. Es inyección de dependencias sin
 * framework: la app le pasa `db` y los tests una base de datos aislada.
 */
export function createDexieTripRepository(db: AppDb): TripRepository {
  return {
    list() {
      return db.trips.orderBy('startDate').toArray()
    },

    getById(id) {
      return db.trips.get(id)
    },

    async create(input) {
      // parse() valida (lanza ZodError si algo no cumple) y además normaliza,
      // p. ej. recorta los espacios del nombre. Nunca guardamos el input crudo.
      const trip = { ...newEntityBase(), ...NewTripSchema.parse(input) }
      await db.trips.add(trip)
      return trip
    },

    update(id, changes) {
      // Leer + escribir en una transacción: nadie puede modificar el viaje
      // entre que lo leemos y lo guardamos.
      return db.transaction('rw', db.trips, async () => {
        const current = await db.trips.get(id)
        if (!current) throw new EntityNotFoundError('Trip', id)

        // Validamos la entidad COMPLETA ya fusionada: así la regla
        // startDate <= endDate se comprueba aunque solo cambie una fecha.
        // id y createdAt van después del spread para que `changes` no pueda
        // sobrescribirlos aunque alguien los cuele en runtime.
        const updated = TripSchema.parse({
          ...current,
          ...changes,
          id: current.id,
          createdAt: current.createdAt,
          updatedAt: nowIso(),
        })
        await db.trips.put(updated)
        return updated
      })
    },

    remove(id) {
      // Todas las tablas afectadas en la misma transacción: o se borra todo
      // (viaje + maletas + contenido) o no se borra nada.
      return db.transaction(
        'rw',
        [db.trips, db.luggages, db.itemQuantities],
        async () => {
          const luggageIds = await db.luggages
            .where('tripId')
            .equals(id)
            .primaryKeys()
          await deleteLuggagesCascade(db, luggageIds)
          await db.trips.delete(id)
        },
      )
    },
  }
}
