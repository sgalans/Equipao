import { v7 as uuidv7 } from 'uuid'
import type { AppDb } from './db'

const DEVICE_ID_KEY = 'deviceId'

/**
 * Devuelve el UUID de este dispositivo y lo crea la primera vez (get-or-create).
 *
 * Servirá en la fase 2 para la sincronización: saber qué dispositivo hizo cada
 * cambio. Vive en IndexedDB (no en localStorage) para que se borre junto con
 * los datos: un dispositivo "nuevo" para el sync = datos nuevos.
 *
 * Recibe la base de datos por parámetro (inyección de dependencias) en lugar
 * de importar el singleton: así los tests pasan su propia base de datos aislada.
 */
export async function getDeviceId(db: AppDb): Promise<string> {
  // Transacción de lectura-escritura: la lectura y la posible escritura son
  // atómicas. Sin ella, dos pestañas abiertas a la vez podrían leer "no
  // existe" las dos y generar dos ids distintos (condición de carrera).
  return db.transaction('rw', db.meta, async () => {
    const existing = await db.meta.get(DEVICE_ID_KEY)
    if (existing) return existing.value

    const deviceId = uuidv7()
    await db.meta.add({ key: DEVICE_ID_KEY, value: deviceId })
    return deviceId
  })
}
