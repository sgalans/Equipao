import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { EntityNotFoundError } from '@/shared/domain/errors'
import { LuggageSchema, NewLuggageSchema } from '../domain/luggage'
import type { LuggageRepository } from '../domain/luggageRepository'
import { copyName } from '../domain/copyName'
import {
  hasAnythingPacked,
  isFullyPacked,
  packingProgress,
} from '../domain/packing'
import { containerItemIds } from './containers'

/**
 * Adapter: implementación de LuggageRepository sobre Dexie.
 *
 * Patrón factory: la función recibe sus dependencias (la base de datos) y
 * devuelve un objeto que cumple la interfaz. Es inyección de dependencias sin
 * framework: la app le pasa `db` y los tests una base de datos aislada.
 */
/** Agrupa una lista por clave en un Map (para cruzar tablas en memoria). */
function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const group = groups.get(key(row)) ?? []
    group.push(row)
    groups.set(key(row), group)
  }
  return groups
}

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
      const [luggages, lines, containers] = await Promise.all([
        list(),
        db.itemQuantities.toArray(),
        containerItemIds(db),
      ])
      // Las líneas contenedor son los compartimentos ("listo" = guardada);
      // las demás, los artículos (ver containers.ts).
      const isContainer = (line: { itemId: string }) =>
        containers.has(line.itemId)
      const compartments = lines.filter(isContainer).map((line) => ({
        luggageId: line.luggageId,
        isReady: isFullyPacked(line),
      }))
      const quantities = lines.filter((line) => !isContainer(line))

      // Agrupamos por maleta en Maps (búsqueda O(1) por id).
      const quantitiesByLuggage = groupBy(quantities, (q) => q.luggageId)
      const compartmentsByLuggage = groupBy(compartments, (c) => c.luggageId)

      // La regla de progreso es la MISMA que en el detalle (packing.ts).
      return luggages.map((luggage) => {
        const entries = quantitiesByLuggage.get(luggage.id) ?? []
        const compartmentList = compartmentsByLuggage.get(luggage.id) ?? []
        return {
          ...luggage,
          ...packingProgress(entries, compartmentList),
          hasPacked: hasAnythingPacked(entries, compartmentList),
        }
      })
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
      // Una maleta y sus líneas (compartimentos incluidos: son líneas
      // contenedor) forman un AGREGADO (DDD) con la maleta como raíz: se
      // copian juntas o no se copia nada.
      return db.transaction(
        'rw',
        [db.luggages, db.itemQuantities],
        async () => {
          const source = await db.luggages.get(id)
          if (!source) throw new EntityNotFoundError('Luggage', id)

          const copy = LuggageSchema.parse({
            ...newEntityBase(),
            name: copyName(source.name),
            // La descripción es parte de la "plantilla": se copia.
            description: source.description,
          })

          // Cada línea se copia ENTERA (`position` incluida: mismo orden
          // manual) con un id NUEVO. Este mapa traduce "línea original → línea
          // de la copia", para que cada artículo apunte a SU compartimento.
          const lines = await db.itemQuantities
            .where('luggageId')
            .equals(id)
            .toArray()
          const idMap = new Map(lines.map((line) => [line.id, newEntityBase()]))
          const copies = lines.map((line) => ({
            ...line,
            ...idMap.get(line.id)!,
            luggageId: copy.id,
            compartmentId:
              line.compartmentId === null
                ? null
                : (idMap.get(line.compartmentId)?.id ?? null),
            // Decisión de producto: la copia empieza sin nada guardado (ni los
            // compartimentos "listos").
            nAlreadyPacked: 0,
          }))

          await db.luggages.add(copy)
          // bulkAdd: una sola operación para todas las filas.
          await db.itemQuantities.bulkAdd(copies)
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
          // Solo copiamos los campos permitidos (no un spread de `changes`).
          name: changes.name ?? current.name,
          description: changes.description ?? current.description,
          updatedAt: nowIso(),
        })
        await db.luggages.put(updated)
        return updated
      })
    },

    resetPacked(id) {
      return db.transaction(
        'rw',
        [db.luggages, db.itemQuantities],
        async () => {
          if (!(await db.luggages.get(id))) {
            throw new EntityNotFoundError('Luggage', id)
          }
          // Todas las líneas de la maleta, también las de los compartimentos
          // (su "listo" es su línea guardada). Solo se toca lo que cambia:
          // así updatedAt sigue diciendo la verdad.
          const now = nowIso()
          await db.itemQuantities
            .where('luggageId')
            .equals(id)
            .modify((line) => {
              if (line.nAlreadyPacked === 0) return
              line.nAlreadyPacked = 0
              line.updatedAt = now
            })
        },
      )
    },

    remove(id) {
      // ON DELETE CASCADE a mano (IndexedDB no tiene claves foráneas): hijos
      // primero (contenido y compartimentos) y luego el padre, todo en una
      // transacción para que nunca queden filas huérfanas si algo falla.
      // (Los compartimentos son líneas: caen con el contenido.)
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
