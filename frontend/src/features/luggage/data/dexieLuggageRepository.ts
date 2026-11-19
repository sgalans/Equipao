import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { EntityNotFoundError } from '@/shared/domain/errors'
import { LuggageSchema, NewLuggageSchema } from '../domain/luggage'
import type { LuggageRepository } from '../domain/luggageRepository'
import { copyName } from '../domain/copyName'
import { luggageProgress } from '../domain/packing'

/**
 * Adapter: implementación de LuggageRepository sobre Dexie.
 *
 * Patrón factory: la función recibe sus dependencias (la base de datos) y
 * devuelve un objeto que cumple la interfaz. Es inyección de dependencias sin
 * framework: la app le pasa `db` y los tests una base de datos aislada.
 */
export function createDexieLuggageRepository(db: AppDb): LuggageRepository {
  // Función local (no `this.list`): ver la nota en dexieItemQuantityRepository.
  function list() {
    // Índice createdAt + reverse(): la maleta recién creada sale arriba,
    // justo debajo del campo donde se acaba de escribir su nombre.
    return db.luggages.orderBy('createdAt').reverse().toArray()
  }

  return {
    list,

    async listSummaries() {
      // DOS consultas en total, tenga las maletas que tenga (no una por
      // maleta: eso sería el problema N+1). Con el volumen de una app de
      // equipaje, leer todas las cantidades y agrupar en memoria es
      // instantáneo.
      const [luggages, quantities] = await Promise.all([
        list(),
        db.itemQuantities.toArray(),
      ])

      // Agrupamos por maleta en un Map (búsqueda O(1) por id).
      const byLuggage = new Map<string, typeof quantities>()
      for (const quantity of quantities) {
        const group = byLuggage.get(quantity.luggageId) ?? []
        group.push(quantity)
        byLuggage.set(quantity.luggageId, group)
      }

      // La regla de progreso es la MISMA que en el detalle (packing.ts).
      return luggages.map((luggage) => ({
        ...luggage,
        ...luggageProgress(byLuggage.get(luggage.id) ?? []),
      }))
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

    duplicate(id) {
      // Una maleta, sus compartimentos y sus artículos forman un AGREGADO
      // (DDD) con la maleta como raíz: se copian juntos o no se copia nada.
      return db.transaction(
        'rw',
        [db.luggages, db.compartments, db.itemQuantities],
        async () => {
          const source = await db.luggages.get(id)
          if (!source) throw new EntityNotFoundError('Luggage', id)

          const copy = LuggageSchema.parse({
            ...newEntityBase(),
            name: copyName(source.name),
          })

          // Los compartimentos de la copia tienen ids NUEVOS. Este mapa
          // traduce "compartimento original → compartimento de la copia",
          // para que cada artículo apunte al de SU maleta (invariante).
          const compartmentIdMap = new Map<string, string>()
          const compartments = (
            await db.compartments
              .where('luggageId')
              .equals(id)
              .sortBy('createdAt')
          ).map((compartment) => {
            const base = newEntityBase()
            compartmentIdMap.set(compartment.id, base.id)
            return { ...compartment, ...base, luggageId: copy.id }
          })

          // Se copian en el mismo orden: los UUID v7 nuevos se generan en
          // orden creciente, así que la copia conserva el orden de añadido.
          const quantities = (
            await db.itemQuantities
              .where('luggageId')
              .equals(id)
              .sortBy('createdAt')
          ).map((quantity) => ({
            ...quantity,
            ...newEntityBase(),
            luggageId: copy.id,
            compartmentId:
              quantity.compartmentId === null
                ? null
                : (compartmentIdMap.get(quantity.compartmentId) ?? null),
            // Decisión de producto: la copia empieza sin nada guardado.
            nAlreadyPacked: 0,
          }))

          await db.luggages.add(copy)
          // bulkAdd: una sola operación para todas las filas.
          await db.compartments.bulkAdd(compartments)
          await db.itemQuantities.bulkAdd(quantities)
          return copy
        },
      )
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
      // primero (contenido y compartimentos) y luego el padre, todo en una
      // transacción para que nunca queden filas huérfanas si algo falla.
      return db.transaction(
        'rw',
        [db.luggages, db.itemQuantities, db.compartments],
        async () => {
          await db.itemQuantities.where('luggageId').equals(id).delete()
          await db.compartments.where('luggageId').equals(id).delete()
          await db.luggages.delete(id)
        },
      )
    },
  }
}
