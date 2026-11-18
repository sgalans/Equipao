import { v7 as uuidv7 } from 'uuid'

/** Instante actual en ISO 8601 UTC, el formato de createdAt/updatedAt. */
export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Campos que rellena siempre la capa de datos al crear una entidad: el
 * usuario nunca elige el id ni los timestamps.
 */
export function newEntityBase() {
  const now = nowIso()
  return { id: uuidv7(), createdAt: now, updatedAt: now }
}
