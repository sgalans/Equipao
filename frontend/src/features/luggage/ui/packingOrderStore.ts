import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Compartment } from '../domain/compartment'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import { isFullyPacked } from '../domain/packing'

/**
 * Interruptor "Ocultar listos" (decisión de producto).
 *
 * Listo o no listo es un DATO (el círculo). Ocultar es solo VISTA: lo listo
 * deja de verse en la lista, pero NADA se mueve de sitio (sin ocultar, cada
 * cosa está en su orden). Todo lo listo se consulta siempre en la ventana
 * "Listos" (al tocar la barra de progreso).
 * - Artículos: se oculta cada artículo listo.
 * - Compartimentos: se ocultan ENTEROS solo si están COMPLETOS (marcados
 *   como listos Y con todos sus artículos listos). Si no, su cabecera se
 *   queda y solo se ocultan sus artículos listos.
 *
 * Para que nada desaparezca bajo el dedo, se guarda una FOTO de qué estaba
 * hecho al ocultar: lo que se complete después se queda a la vista (y el ojo
 * vuelve a "se ven") hasta que se vuelva a tocar el ojo. Lo que se desmarca
 * reaparece al momento.
 *
 * La foto guarda en un mismo conjunto ids de líneas (ItemQuantity) y de
 * compartimentos: son UUID v7, no pueden coincidir.
 */
export type HiddenSnapshot = ReadonlySet<string>

/** Artículos de un compartimento. */
function entriesOf(compartment: Compartment, entries: LuggageEntry[]) {
  return entries.filter((entry) => entry.compartmentId === compartment.id)
}

/**
 * Compartimento COMPLETO: marcado como listo y con todos sus artículos
 * listos (uno vacío y marcado también lo está: no le falta nada).
 */
export function isCompartmentComplete(
  compartment: Compartment,
  entries: LuggageEntry[],
): boolean {
  return (
    compartment.isReady && entriesOf(compartment, entries).every(isFullyPacked)
  )
}

/** Foto de lo hecho AHORA: líneas listas y compartimentos completos. */
export function doneIds(
  entries: LuggageEntry[],
  compartments: Compartment[],
): HiddenSnapshot {
  return new Set([
    ...entries.filter(isFullyPacked).map((entry) => entry.id),
    ...compartments
      .filter((c) => isCompartmentComplete(c, entries))
      .map((c) => c.id),
  ])
}

/**
 * ¿Está oculto este artículo? Si estaba en la foto Y sigue listo (lo que se
 * desmarca vuelve a verse al momento).
 */
export function isHiddenEntry(
  entry: LuggageEntry,
  hidden: HiddenSnapshot | undefined,
): boolean {
  return isFullyPacked(entry) && (hidden?.has(entry.id) ?? false)
}

/** ¿Está oculto el compartimento entero? Si estaba en la foto Y sigue completo. */
export function isHiddenCompartment(
  compartment: Compartment,
  entries: LuggageEntry[],
  hidden: HiddenSnapshot | undefined,
): boolean {
  return (
    isCompartmentComplete(compartment, entries) &&
    (hidden?.has(compartment.id) ?? false)
  )
}

/**
 * ¿Está oculto todo lo hecho? Decide el estado del ojo: tachado si sí. Sin
 * nada hecho no hay nada que ocultar (el botón no se muestra).
 */
export function isAllDoneHidden(
  entries: LuggageEntry[],
  compartments: Compartment[],
  hidden: HiddenSnapshot | undefined,
): boolean {
  return (
    hidden !== undefined &&
    [...doneIds(entries, compartments)].every((id) => hidden.has(id))
  )
}

interface PackingOrderState {
  /**
   * ids ocultos de cada maleta (por id de maleta); sin entrada = nada
   * oculto. Arrays y no Set: localStorage guarda JSON.
   */
  hidden: Record<string, string[]>
  hide: (luggageId: string, ids: HiddenSnapshot) => void
  /** Vuelve a mostrarlo todo. */
  show: (luggageId: string) => void
}

/**
 * Estado de UI (Zustand) persistido en localStorage, como los compartimentos
 * plegados: se recuerda al recargar o cuando iOS cierra la app en segundo
 * plano. ¿Por qué no en IndexedDB? Es cómo ves la lista en ESTE dispositivo,
 * no un dato de la maleta (no debe cambiar su updatedAt ni sincronizarse).
 */
export const usePackingOrder = create<PackingOrderState>()(
  persist(
    (set) => ({
      hidden: {},
      hide: (luggageId, ids) =>
        set((state) => ({
          hidden: { ...state.hidden, [luggageId]: [...ids] },
        })),
      show: (luggageId) =>
        set((state) => {
          if (!state.hidden[luggageId]) return state // nada que cambiar
          const hidden = { ...state.hidden }
          delete hidden[luggageId]
          return { hidden }
        }),
    }),
    {
      // Prefijo de la app, como el resto de claves. Clave nueva (v2) porque
      // el formato cambió: lo guardado con el formato anterior se ignora.
      name: 'luggage-app:hidden-packed-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ hidden: state.hidden }),
    },
  ),
)

/**
 * ids ocultos guardados de una maleta (undefined = nada oculto). Devuelve el
 * array guardado tal cual (misma referencia mientras no cambie): un selector
 * que creara un Set nuevo en cada llamada haría re-renderizar sin fin.
 */
export function useStoredHidden(luggageId: string): string[] | undefined {
  return usePackingOrder((state) => state.hidden[luggageId])
}
