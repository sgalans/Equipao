import { z } from 'zod'

/**
 * Bloques reutilizables para los esquemas del dominio.
 *
 * Con Zod el esquema es la *single source of truth*: de él se derivan tanto
 * la validación en runtime (`schema.parse`) como el tipo TypeScript
 * (`z.infer`). Así tipo y validación nunca pueden desincronizarse.
 */

/** UUID (usamos v7, ordenable por fecha de creación). */
export const IdSchema = z.uuid()

/**
 * Fecha de calendario sin hora: 'YYYY-MM-DD'.
 * Evita el bug de zonas horarias de `Date` (un viaje del día 5 que aparece el 4).
 * Al tener formato fijo, comparar dos fechas como strings equivale a compararlas
 * cronológicamente ('2026-01-09' < '2026-01-10').
 */
// Los mensajes de error van en el esquema (single source of truth): todos los
// formularios que lo usen muestran el mismo texto. Un <input type="date">
// vacío envía '', que también cae en este mensaje.
export const IsoDateSchema = z.iso.date({ error: 'Introduce una fecha válida' })

/** Instante exacto en UTC, ISO 8601: '2026-11-17T15:39:00.000Z'. */
export const TimestampSchema = z.iso.datetime()

/** Nombre visible: sin espacios sobrantes, no vacío y con un límite razonable. */
export const NameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(100, 'El nombre no puede superar los 100 caracteres')

/**
 * Campos comunes a todas las entidades persistidas. Es un "shape" (objeto
 * plano de esquemas), no un z.object, para poder combinarlo con spread:
 * z.object({ ...entityBaseShape, ...camposPropios }).
 */
export const entityBaseShape = {
  id: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}
