import { useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { DuplicateError } from '@/shared/domain/errors'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import type { Item } from '../domain/item'

/** Unión pendiente de confirmar: "¿unir «peolota» con «pelota»?". */
export interface PendingMerge {
  sourceId: string
  sourceName: string
  target: Item
}

/**
 * Renombrar un artículo (o un compartimento: su contenedor del catálogo).
 * Decisión del usuario: el nombre es del ARTÍCULO, así que cambia en todas
 * las maletas y en el catálogo, se renombre desde donde se renombre (la
 * fila de la maleta, el compartimento o el catálogo: los tres usan esto).
 *
 * Si el nombre nuevo es el de OTRO artículo del mismo tipo, no se falla: se
 * propone UNIR los dos (p. ej. corregir "peolota" → "pelota"), con
 * confirmación porque es irreversible (MergeItemsDialog). Un artículo y un
 * compartimento no se unen: se explica en `error`.
 */
export function useItemRename() {
  const { items } = useRepositories()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingMerge | null>(null)

  async function rename(itemId: string, currentName: string, rawName: string) {
    setError(null)
    const name = rawName.trim()
    if (name === '' || name === currentName) return
    try {
      // Mismo criterio que el catálogo para "ya existe" (sin mayúsculas ni
      // tildes). Si es él mismo (p. ej. solo cambia una mayúscula), se renombra.
      const existing = await items.findByName(name)
      if (existing && existing.id !== itemId) {
        const current = await items.getById(itemId)
        if (current && current.isContainer !== existing.isContainer) {
          setError(
            existing.isContainer
              ? `Ya hay un compartimento llamado «${existing.name}».`
              : `Ya hay un artículo llamado «${existing.name}».`,
          )
          return
        }
        setPending({
          sourceId: itemId,
          sourceName: currentName,
          target: existing,
        })
        return
      }
      await items.update(itemId, { name })
    } catch (e) {
      // Otra pestaña pudo crearlo justo antes: se explica, no es un fallo.
      if (e instanceof DuplicateError) setError(`${e.message}.`)
      else reportError(e)
    }
  }

  async function confirmMerge() {
    if (!pending) return
    await items.merge(pending.sourceId, pending.target.id)
    setPending(null)
  }

  return {
    rename,
    error,
    clearError: () => setError(null),
    pending,
    confirmMerge,
    cancelMerge: () => setPending(null),
  }
}
