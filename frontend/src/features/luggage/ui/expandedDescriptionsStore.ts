import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * Descripciones largas ABIERTAS por el usuario ("Ver más"). Por defecto se
 * ven plegadas a 3 líneas (decisión del usuario: no quitan sitio a la lista
 * hasta que se abren); al abrirla, se recuerda para esa maleta. Mismo patrón
 * que collapsedCompartmentsStore: estado de UI de este dispositivo
 * (localStorage), no un dato de la maleta.
 */
interface ExpandedDescriptionsState {
  /** ids de maletas con la descripción abierta. */
  expanded: Record<string, true>
  toggle: (luggageId: string) => void
  /**
   * La deja abierta (p. ej. la "Maleta básica" recién creada: sus
   * instrucciones se leen enteras la primera vez). Idempotente.
   */
  expand: (luggageId: string) => void
  /** Al borrar la maleta: que no quede basura en localStorage. */
  forget: (luggageId: string) => void
}

export const useExpandedDescriptions = create<ExpandedDescriptionsState>()(
  persist(
    (set) => ({
      expanded: {},
      toggle: (luggageId) =>
        set((state) => {
          const expanded = { ...state.expanded }
          if (expanded[luggageId]) delete expanded[luggageId]
          else expanded[luggageId] = true
          return { expanded }
        }),
      expand: (luggageId) =>
        set((state) =>
          state.expanded[luggageId]
            ? state // ya abierta: nada que cambiar
            : { expanded: { ...state.expanded, [luggageId]: true } },
        ),
      forget: (luggageId) =>
        set((state) => {
          if (!state.expanded[luggageId]) return state // nada que cambiar
          const expanded = { ...state.expanded }
          delete expanded[luggageId]
          return { expanded }
        }),
    }),
    {
      name: 'luggage-app:expanded-descriptions',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ expanded: state.expanded }),
    },
  ),
)
