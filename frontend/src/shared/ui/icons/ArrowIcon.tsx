/**
 * Flecha hacia arriba o hacia abajo ("Subir"/"Bajar" un artículo o
 * compartimento). Ver TrashIcon para las notas de accesibilidad.
 */
export function ArrowIcon({ direction }: { direction: 'up' | 'down' }) {
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
      // Una sola flecha dibujada hacia arriba; hacia abajo, girada.
      style={direction === 'down' ? { transform: 'rotate(180deg)' } : undefined}
    >
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  )
}
