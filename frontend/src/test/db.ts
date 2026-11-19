import { v7 as uuidv7 } from 'uuid'
import { onTestFinished } from 'vitest'
import { AppDb } from '@/shared/db/db'

/**
 * Crea una base de datos vacía y exclusiva para el test que la llama, y la
 * elimina automáticamente al acabar ese test (onTestFinished).
 *
 * Nombre único por test = aislamiento total: ningún test ve datos de otro,
 * así que se pueden ejecutar en cualquier orden o en paralelo.
 */
export function createTestDb(): AppDb {
  const db = new AppDb(`test-${uuidv7()}`)
  onTestFinished(() => db.delete())
  return db
}

/** Timestamp ISO fijo para crear filas de prueba de forma determinista. */
export const TEST_TIMESTAMP = '2026-01-01T00:00:00.000Z'
