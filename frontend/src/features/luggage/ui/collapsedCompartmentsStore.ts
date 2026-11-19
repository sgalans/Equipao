import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * Qué compartimentos están plegados. Primer uso de Zustand en el proyecto,
 * justo en su papel previsto (ver CLAUDE.md): ESTADO DE UI, no datos.
 *
 * ¿Por qué no en IndexedDB con los datos? Plegar es una preferencia de vista
 * de este dispositivo, no parte de la maleta: no debe sincronizarse en la
 * fase 2 ni cambiar el updatedAt del compartimento.
 *
 * ¿Por qué no un useState? Debe sobrevivir a salir de la maleta y volver (y
 * a cerrar la app): `persist` lo guarda en localStorage automáticamente.
 */
interface CollapsedCompartmentsState {
  /** ids de compartimentos plegados (un Record serializa bien a JSON). */
  collapsed: Record<string, true>
  toggle: (compartmentId: string) => void
  /** Despliega (p. ej. al tocar su "+": no se añade a algo que no se ve). */
  expand: (compartmentId: string) => void
}

export const useCollapsedCompartments = create<CollapsedCompartmentsState>()(
  persist(
    (set) => ({
      collapsed: {},
      toggle: (compartmentId) =>
        // Actualización inmutable: se crea un objeto nuevo en lugar de
        // modificar el anterior, así Zustand detecta el cambio y re-renderiza.
        set((state) => {
          const collapsed = { ...state.collapsed }
          if (collapsed[compartmentId]) delete collapsed[compartmentId]
          else collapsed[compartmentId] = true
          return { collapsed }
        }),
      expand: (compartmentId) =>
        set((state) => {
          if (!state.collapsed[compartmentId]) return state // nada que cambiar
          const collapsed = { ...state.collapsed }
          delete collapsed[compartmentId]
          return { collapsed }
        }),
    }),
    {
      // Clave en localStorage. Con prefijo para no chocar con otras apps
      // servidas desde el mismo dominio.
      name: 'luggage-app:collapsed-compartments',
      storage: createJSONStorage(() => localStorage),
      // Solo se persiste el dato, no las funciones.
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
)

/**
 * Hook selector: el componente solo se re-renderiza si cambia el estado de
 * SU compartimento, no cuando se pliega cualquier otro.
 */
export function useIsCollapsed(compartmentId: string): boolean {
  return useCollapsedCompartments(
    (state) => state.collapsed[compartmentId] === true,
  )
}
