/**
 * Icono de caja (contenedor): "Convertir en compartimento / en artículo".
 * Ver TrashIcon para las notas de accesibilidad.
 */
export function BoxIcon() {
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
      {/* Caja abierta vista de frente: tapa y cuerpo. */}
      <path d="M3 7h18v3H3z" />
      <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
      <path d="M10 14h4" />
    </svg>
  )
}
