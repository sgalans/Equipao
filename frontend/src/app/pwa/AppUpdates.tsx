import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { db } from '@/shared/db/db'
import { UpdateBanner } from './UpdateBanner'

/** Cada cuánto se comprueba si hay versión nueva con la app abierta. */
const UPDATE_CHECK_MS = 60 * 60 * 1000

/**
 * Avisos de actualización (contenedor; la vista es UpdateBanner):
 *
 * 1. Versión nueva publicada: el service worker la descarga, pero NO se
 *    activa sola (registerType 'prompt'): se pregunta. "Actualizar" la
 *    activa y recarga; "Luego" la deja para la próxima vez.
 * 2. Otra pestaña actualizó la app con una migración de la BD: Dexie cierra
 *    la conexión de ESTA pestaña para que la migración pueda aplicarse, así
 *    que esta pestaña ya no puede leer ni guardar: hay que recargar.
 *
 * Vive en app/ (no en la UI de una feature) porque conoce el service worker
 * y la base de datos concreta.
 */
export function AppUpdates() {
  const [isDbOutdated, setIsDbOutdated] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Una PWA puede quedarse abierta días: se comprueba cada hora.
      if (registration) {
        setInterval(() => void registration.update(), UPDATE_CHECK_MS)
      }
    },
  })

  useEffect(() => {
    // Dexie cierra la conexión por defecto tras este evento (lo dejamos:
    // así la otra pestaña puede migrar); aquí solo se avisa al usuario.
    const onVersionChange = () => setIsDbOutdated(true)
    db.on('versionchange', onVersionChange)
    return () => db.on('versionchange').unsubscribe(onVersionChange)
  }, [])

  if (isDbOutdated) {
    return (
      <UpdateBanner
        message="Equipao se ha actualizado en otra pestaña."
        actionLabel="Recargar"
        onAction={() => window.location.reload()}
      />
    )
  }

  if (needRefresh) {
    return (
      <UpdateBanner
        message="Nueva versión disponible."
        actionLabel="Actualizar"
        onAction={() => void updateServiceWorker(true)}
        onDismiss={() => setNeedRefresh(false)}
      />
    )
  }

  return null
}
