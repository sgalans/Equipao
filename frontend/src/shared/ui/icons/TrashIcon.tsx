/**
 * Icono de papelera en SVG inline (sin dependencias).
 *
 * - stroke="currentColor": toma el color del texto del botón, así el icono
 *   cambia con el tema claro/oscuro y con :hover sin CSS extra.
 * - aria-hidden: es decorativo; el nombre accesible lo pone el botón
 *   (aria-label), si no el lector de pantalla leería un "imagen" sin sentido.
 */
export function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}
