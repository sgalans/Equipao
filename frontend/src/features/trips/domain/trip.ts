import { z } from 'zod'
import {
  entityBaseShape,
  IsoDateSchema,
  NameSchema,
} from '../../../shared/domain/schemas'

/** Campos que decide el usuario (sin id ni timestamps). */
const tripFields = {
  name: NameSchema,
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
}

/**
 * Regla de negocio: un viaje no puede terminar antes de empezar.
 * Se define una vez y se aplica a los dos esquemas (DRY).
 * La comparación de strings es válida porque ambos son 'YYYY-MM-DD'.
 */
const datesInOrder = (trip: { startDate: string; endDate: string }) =>
  trip.startDate <= trip.endDate

const datesInOrderError = {
  message: 'La fecha de fin no puede ser anterior a la de inicio',
  // `path` asocia el error al campo endDate: el formulario sabrá dónde pintarlo.
  path: ['endDate'],
}

/** Viaje tal y como se guarda en la base de datos. */
export const TripSchema = z
  .object({ ...entityBaseShape, ...tripFields })
  .refine(datesInOrder, datesInOrderError)

/** Datos para crear un viaje (input de formulario / repositorio). */
export const NewTripSchema = z
  .object(tripFields)
  .refine(datesInOrder, datesInOrderError)

export type Trip = z.infer<typeof TripSchema>
export type NewTrip = z.infer<typeof NewTripSchema>
