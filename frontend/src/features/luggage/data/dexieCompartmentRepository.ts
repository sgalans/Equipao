import { newEntityBase, nowIso } from '@/shared/data/entityBase'
import type { AppDb } from '@/shared/db/db'
import { EntityNotFoundError } from '@/shared/domain/errors'
import { CompartmentSchema, NewCompartmentSchema } from '../domain/compartment'
import type { CompartmentRepository } from '../domain/compartmentRepository'

export function createDexieCompartmentRepository(
  db: AppDb,
): CompartmentRepository {
  return {
    listByLuggage(luggageId) {
      return db.compartments
        .where('luggageId')
        .equals(luggageId)
        .sortBy('createdAt')
    },

    create(input) {
      const data = NewCompartmentSchema.parse(input)
      // FOREIGN KEY: comprobación + insert en la misma transacción.
      return db.transaction('rw', [db.compartments, db.luggages], async () => {
        if (!(await db.luggages.get(data.luggageId))) {
          throw new EntityNotFoundError('Luggage', data.luggageId)
        }
        const compartment = { ...newEntityBase(), ...data }
        await db.compartments.add(compartment)
        return compartment
      })
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
