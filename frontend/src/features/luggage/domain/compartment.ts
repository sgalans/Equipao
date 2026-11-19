import { z } from 'zod'
import { entityBaseShape, IdSchema, NameSchema } from '@/shared/domain/schemas'

/**
 * Compartimento: subgrupo de artículos dentro de una maleta (neceser,
 * mochila de mano…). Un solo nivel: no se anidan.
 */
const compartmentFields = {
  // Clave foránea → Luggage (on delete cascade, lo hace el repositorio).
  luggageId: IdSchema,
  name: NameSchema,
}

export const CompartmentSchema = z.object({
  ...entityBaseShape,
  ...compartmentFields,
})
export const NewCompartmentSchema = z.object(compartmentFields)

export type Compartment = z.infer<typeof CompartmentSchema>
export type NewCompartment = z.infer<typeof NewCompartmentSchema>
