import { z } from 'zod'
import {
  entityBaseShape,
  IdSchema,
  NameSchema,
} from '../../../shared/domain/schemas'

const luggageFields = {
  // Clave foránea → Trip. Zod solo comprueba el formato; que el viaje exista
  // de verdad lo garantizará el repositorio (IndexedDB no tiene FOREIGN KEY).
  tripId: IdSchema,
  name: NameSchema,
}

export const LuggageSchema = z.object({ ...entityBaseShape, ...luggageFields })
export const NewLuggageSchema = z.object(luggageFields)

export type Luggage = z.infer<typeof LuggageSchema>
export type NewLuggage = z.infer<typeof NewLuggageSchema>
