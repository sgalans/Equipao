/**
 * Icono de "Seleccionar artículos": una lista con casillas (una marcada).
 * Un ✓ solo no se asociaba con "elegir varios" (decisión del usuario); las
 * casillas junto a líneas sí (es el dibujo habitual de "seleccionar" en
 * listas). Ver TrashIcon para las notas de accesibilidad.
 */
export function SelectItemsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Casilla marcada + su línea */}
      <rect x="3" y="4" width="6" height="6" rx="1" />
      <path d="m4.5 7 1 1 2-2" />
      <path d="M13 7h8" />
      {/* Casilla vacía + su línea */}
      <rect x="3" y="14" width="6" height="6" rx="1" />
      <path d="M13 17h8" />
    </svg>
  )
}
