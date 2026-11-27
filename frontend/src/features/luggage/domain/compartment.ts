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
  // "Listo" PROPIO del compartimento (decisión de producto): "el neceser está
  // cerrado y en la maleta". Independiente de sus artículos: se puede marcar
  // aunque alguno no esté guardado (la UI lo avisa).
  isReady: z.boolean(),
}

export const CompartmentSchema = z.object({
  ...entityBaseShape,
  ...compartmentFields,
  // Orden manual dentro de la maleta (fractional indexing, como los
  // artículos: ver domain/position.ts). Lo asigna el repositorio.
  position: z.string().min(1),
  // Contenedor del catálogo que es este compartimento (refactor/
  // compartments): para renombrarlo o unirlo como cualquier artículo.
  itemId: IdSchema,
})
export const NewCompartmentSchema = z.object({
  ...compartmentFields,
  isReady: z.boolean().default(false),
})

export type Compartment = z.infer<typeof CompartmentSchema>
// z.input: al crear, isReady es opcional (por defecto false).
export type NewCompartment = z.input<typeof NewCompartmentSchema>
