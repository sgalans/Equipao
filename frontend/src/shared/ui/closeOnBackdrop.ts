import type { MouseEvent } from 'react'

/**
 * Cerrar una hoja (<dialog> con showModal) al tocar FUERA, en el fondo
 * oscuro. Un toque en el ::backdrop llega como clic sobre el PROPIO
 * <dialog>; si su contenido va en un hijo que lo llena entero (ver
 * sheet.module.css → .content), un toque dentro tiene otro target.
 *
 * (El atributo `closedby="any"` lo haría solo, pero Safari aún no lo
 * admite.) Solo es un atajo táctil: con teclado se cierra con Escape y con
 * el botón "Cerrar" de cada hoja.
 */
export function closeOnBackdrop(onClose: () => void) {
  return (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose()
  }
}
