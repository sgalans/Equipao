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
  .object({ ...entityBaseShape, ...itemQuantityFields })
  .refine(packedWithinTotal, packedWithinTotalError)

export const NewItemQuantitySchema = z
  .object(itemQuantityFields)
  .refine(packedWithinTotal, packedWithinTotalError)

export type ItemQuantity = z.infer<typeof ItemQuantitySchema>
export type NewItemQuantity = z.infer<typeof NewItemQuantitySchema>
