import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

/**
 * Abre el ⋯ de una maleta (en el listado o en su cabecera) y elige una
 * acción de la hoja: "Duplicar", "Compartir", "Borrar maleta" o
 * "Seleccionar artículos". Lo usan varios tests: un solo sitio que cambiar
 * si cambia la hoja.
 */
export async function chooseLuggageAction(
  user: UserEvent,
  luggageName: string,
  action: string,
) {
  await user.click(
    await screen.findByRole('button', { name: `Acciones de ${luggageName}` }),
  )
  // within(sheet): showModal() vuelve inerte el resto de la página en el
  // navegador, pero Testing Library no modela `inert`.
  const sheet = await screen.findByRole('dialog', { name: luggageName })
  await user.click(within(sheet).getByRole('button', { name: action }))
}
