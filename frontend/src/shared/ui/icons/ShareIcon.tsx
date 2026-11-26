/**
 * Icono de compartir de iOS (cuadro con flecha hacia arriba): el que la
 * gente ya asocia a "mandar a otra app". Ver TrashIcon para las notas de
 * accesibilidad.
 */
export function ShareIcon() {
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
      <path d="M8 9H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2" />
      <path d="M12 15V3M8 7l4-4 4 4" />
    </svg>
  )
}
