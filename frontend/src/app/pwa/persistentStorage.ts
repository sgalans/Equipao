/** Lo mínimo de la Storage API que usamos (inyectable en los tests). */
type StorageManagerLike = Pick<StorageManager, 'persisted' | 'persist'>

/**
 * Pide al navegador almacenamiento PERSISTENTE: que no borre nuestros datos
 * (IndexedDB) aunque necesite espacio. Con la app instalada en el iPhone es
 * una segunda red de seguridad, además de la exención de los 7 días.
 *
 * No hay backend: si el navegador borrara IndexedDB, las maletas se
 * perderían. Por eso se pide en cada arranque si aún no se ha concedido.
 *
 * Devuelve si los datos quedan protegidos. Nunca lanza: si el navegador no
 * soporta la API o la deniega, la app sigue funcionando igual.
 */
export async function requestPersistentStorage(
  storage: StorageManagerLike | undefined = globalThis.navigator?.storage,
): Promise<boolean> {
  if (!storage?.persist) return false
  try {
    if (await storage.persisted()) return true
    return await storage.persist()
  } catch {
    return false
  }
}
