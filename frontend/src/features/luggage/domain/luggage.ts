import { z } from 'zod'
import { entityBaseShape, NameSchema } from '@/shared/domain/schemas'

/**
 * Máximo de la descripción. Una sola constante para el esquema y los campos
 * de texto (maxLength): si estuviera repetida, el campo podría dejar escribir
 * más de lo que luego se puede guardar. 1000 (antes 500, decisión del
 * usuario: para las instrucciones de "Maleta básica"); subirlo no necesita
 * migración (lo que ya hay sigue siendo válido).
 */
export const DESCRIPTION_MAX_LENGTH = 1000

/** Descripción opcional: notas de la maleta, con saltos de línea. */
export const DescriptionSchema = z
  .string()
  .trim()
  .max(
    DESCRIPTION_MAX_LENGTH,
    `La descripción no puede superar los ${DESCRIPTION_MAX_LENGTH} caracteres`,
  )

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
