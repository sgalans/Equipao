import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { EntityNotFoundError } from '@/shared/domain/errors'
import {
  CompartmentSchema,
  NewCompartmentSchema,
  type Compartment,
  type NewCompartment,
} from '../domain/compartment'
import type { CompartmentRepository } from '../domain/compartmentRepository'
import { lastPosition, positionAfter } from '../domain/position'
import { loadQuantitiesOfOneLuggage } from './loadQuantities'
import { reorderRow } from './reorderRow'

export function createDexieCompartmentRepository(
  db: AppDb,
): CompartmentRepository {
  /** En su orden manual (`position`): sortBy compara como IndexedDB. */
  function listByLuggage(luggageId: string) {
    return db.compartments
      .where('luggageId')
      .equals(luggageId)
      .sortBy('position')
  }

  /** FOREIGN KEY + insert. Llamar dentro de una transacción con luggages. */
  async function insert(input: NewCompartment): Promise<Compartment> {
    const data = NewCompartmentSchema.parse(input)
    if (!(await db.luggages.get(data.luggageId))) {
      throw new EntityNotFoundError('Luggage', data.luggageId)
    }
    // Al final de la maleta (detrás de la última clave).
    const position = positionAfter(
      lastPosition(await listByLuggage(data.luggageId)),
    )
    const compartment = { ...newEntityBase(), ...data, position }
    await db.compartments.add(compartment)
    return compartment
  }

  return {
    listByLuggage,

    create(input) {
      // FOREIGN KEY: comprobación + insert en la misma transacción.
      return db.transaction('rw', [db.compartments, db.luggages], () =>
        insert(input),
      )
    },

    createWithQuantities(input, quantityIds) {
      // Crear el compartimento y mover los artículos en UNA transacción: si
      // algo falla no queda un compartimento vacío creado a medias.
      return db.transaction(
        'rw',
        [db.compartments, db.luggages, db.itemQuantities],
        async () => {
          const compartment = await insert(input)
          const rows = await loadQuantitiesOfOneLuggage(
            db,
            quantityIds,
            compartment.luggageId,
          )
          const now = nowIso()
          await db.itemQuantities.bulkPut(
            rows.map((row) => ({
              ...row,
              compartmentId: compartment.id,
              updatedAt: now,
            })),
          )
          return compartment
        },
      )
    },

    reorder(id, beforeId, afterId) {
      return db.transaction('rw', db.compartments, () =>
        reorderRow(db.compartments, 'Compartment', id, beforeId, afterId),
      )
    },

    toggleReady(id) {
      // Leer + invertir + guardar en una transacción: dos toques rápidos no
      // se pisan (mismo motivo que togglePacked en los artículos).
      return db.transaction('rw', db.compartments, async () => {
        const current = await db.compartments.get(id)
        if (!current) throw new EntityNotFoundError('Compartment', id)

        const updated = CompartmentSchema.parse({
          ...current,
          isReady: !current.isReady,
          updatedAt: nowIso(),
        })
        await db.compartments.put(updated)
        return updated
      })
    },

    update(id, changes) {
      return db.transaction('rw', db.compartments, async () => {
        const current = await db.compartments.get(id)
        if (!current) throw new EntityNotFoundError('Compartment', id)

        const updated = CompartmentSchema.parse({
          ...current,
          name: changes.name ?? current.name,
          updatedAt: nowIso(),
        })
        await db.compartments.put(updated)
        return updated
      })
    },

    remove(id) {
      // ON DELETE SET NULL a mano: los artículos del compartimento pasan a
      // sueltos (compartmentId = null) y después se borra el compartimento.
      // Todo en una transacción: nunca quedan artículos apuntando a un
      // compartimento que ya no existe.
      return db.transaction(
        'rw',
        [db.compartments, db.itemQuantities],
        async () => {
          const now = nowIso()
          await db.itemQuantities
            .where('compartmentId')
            .equals(id)
            .modify({ compartmentId: null, updatedAt: now })
          await db.compartments.delete(id)
        },
      )
    },
  }
}
