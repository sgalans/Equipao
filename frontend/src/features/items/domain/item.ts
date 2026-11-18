import { z } from 'zod'
import { entityBaseShape, NameSchema } from '@/shared/domain/schemas'

/**
 * Item es el catálogo global ("Calcetines", "Cargador"…), reutilizable entre
 * maletas. Cuántos llevas en cada maleta vive en ItemQuantity.
 */
const itemFields = {
  name: NameSchema,
}

export const ItemSchema = z.object({ ...entityBaseShape, ...itemFields })
export const NewItemSchema = z.object(itemFields)

export type Item = z.infer<typeof ItemSchema>
export type NewItem = z.infer<typeof NewItemSchema>
