import { z } from 'zod'
import { entityBaseShape, IdSchema } from '@/shared/domain/schemas'

/**
 * ItemQuantity es la junction table entre Luggage e Item: cuántas unidades de
 * un ítem van en una maleta y cuántas están ya guardadas.
 *
 * Las restricciones CHECK del modelo (Architecture.md) se implementan aquí,
 * porque IndexedDB no las impone:
 *   CHECK (num >= 0)
 *   CHECK (nAlreadyPacked >= 0)
 *   CHECK (nAlreadyPacked <= num)
 */
const itemQuantityFields = {
  luggageId: IdSchema,
  itemId: IdSchema,
  // Compartimento donde va el artículo; null = suelto en la maleta.
  // null explícito (no campo ausente): "suelto" es un estado con significado.
  // Invariante (la comprueba el repositorio): el compartimento pertenece a
  // la MISMA maleta que luggageId.
  compartmentId: IdSchema.nullable(),
  // z.int() rechaza decimales (2.5 calcetines) y valores no finitos.
  num: z.int().min(0),
  nAlreadyPacked: z.int().min(0),
}

const packedWithinTotal = (q: { num: number; nAlreadyPacked: number }) =>
  q.nAlreadyPacked <= q.num

const packedWithinTotalError = {
  message: 'No puede haber más unidades empaquetadas que el total',
  path: ['nAlreadyPacked'],
}

export const ItemQuantitySchema = z
  .object({
    ...entityBaseShape,
    ...itemQuantityFields,
    // Orden manual dentro de la maleta (fractional indexing, ver
    // domain/position.ts). Lo asigna el repositorio: no va en NewItemQuantity.
    position: z.string().min(1),
  })
  .refine(packedWithinTotal, packedWithinTotalError)

export const NewItemQuantitySchema = z
  .object({
    ...itemQuantityFields,
    // Al crear, si no se indica compartimento, el artículo va suelto.
    compartmentId: IdSchema.nullable().default(null),
  })
  .refine(packedWithinTotal, packedWithinTotalError)

export type ItemQuantity = z.infer<typeof ItemQuantitySchema>
// z.input (lo que se PUEDE pasar): compartmentId es opcional al crear.
// z.infer sería la salida tras aplicar el default (siempre presente).
export type NewItemQuantity = z.input<typeof NewItemQuantitySchema>
