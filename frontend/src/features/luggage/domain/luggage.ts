import { z } from 'zod'
import { entityBaseShape, NameSchema } from '@/shared/domain/schemas'

/** Maleta: la entidad principal de la app. */
const luggageFields = {
  name: NameSchema,
}

export const LuggageSchema = z.object({ ...entityBaseShape, ...luggageFields })
export const NewLuggageSchema = z.object(luggageFields)

export type Luggage = z.infer<typeof LuggageSchema>
export type NewLuggage = z.infer<typeof NewLuggageSchema>
