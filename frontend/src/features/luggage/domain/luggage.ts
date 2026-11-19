import { z } from 'zod'
import { entityBaseShape, NameSchema } from '@/shared/domain/schemas'

/** Descripción opcional: notas de la maleta, con saltos de línea. */
export const DescriptionSchema = z
  .string()
  .trim()
  .max(500, 'La descripción no puede superar los 500 caracteres')

/** Maleta: la entidad principal de la app. */
const luggageFields = {
  name: NameSchema,
  // '' = sin descripción: un único valor para "vacío" (no null/undefined).
  description: DescriptionSchema,
}

export const LuggageSchema = z.object({ ...entityBaseShape, ...luggageFields })
export const NewLuggageSchema = z.object({
  ...luggageFields,
  description: DescriptionSchema.default(''),
})

export type Luggage = z.infer<typeof LuggageSchema>
// z.input: al crear, la descripción es opcional (por defecto '').
export type NewLuggage = z.input<typeof NewLuggageSchema>
