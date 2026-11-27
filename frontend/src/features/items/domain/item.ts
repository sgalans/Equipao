import { z } from 'zod'
import { entityBaseShape, NameSchema } from '@/shared/domain/schemas'

/**
 * Item es el catálogo global ("Calcetines", "Cargador"…), reutilizable entre
 * maletas. Cuántos llevas en cada maleta vive en ItemQuantity.
 *
 * Un artículo puede ser un CONTENEDOR (Neceser, Mochila, Maletín…): en una
 * maleta, su línea es un compartimento que contiene otras líneas (patrón
 * Composite; decisión del usuario: refactor/compartments). Lo es solo si se
 * marca: no cualquier artículo puede llevar cosas dentro.
 */
const itemFields = {
  name: NameSchema,
  isContainer: z.boolean(),
}

export const ItemSchema = z.object({ ...entityBaseShape, ...itemFields })
export const NewItemSchema = z.object({
  ...itemFields,
  // Al crear, por defecto es un artículo normal.
  isContainer: z.boolean().default(false),
})

export type Item = z.infer<typeof ItemSchema>
// z.input: al crear, isContainer es opcional (por defecto false).
export type NewItem = z.input<typeof NewItemSchema>
