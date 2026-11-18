import { z } from 'zod'
import { entityBaseShape, NameSchema } from '@/shared/domain/schemas'

/**
 * Item es el catálogo global ("Calcetines", "Cargador"…), reutilizable entre
 * maletas y viajes. Cuántos llevas en cada maleta vive en ItemQuantity.
 */
const itemFields = {
  name: NameSchema,
  // Color en hexadecimal '#RRGGBB': es lo que devuelve <input type="color">.
  // toLowerCase normaliza para que '#FF0000' y '#ff0000' se guarden igual.
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color hexadecimal inválido')
    .toLowerCase(),
}

export const ItemSchema = z.object({ ...entityBaseShape, ...itemFields })
export const NewItemSchema = z.object(itemFields)

export type Item = z.infer<typeof ItemSchema>
export type NewItem = z.infer<typeof NewItemSchema>
