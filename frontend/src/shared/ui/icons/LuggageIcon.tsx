/**
 * Maleta (para el estado vacío). Decorativo: el texto de al lado dice lo
 * mismo, así que aria-hidden. Tamaño por props: aquí se usa grande.
 */
export function LuggageIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Asa, cuerpo, dos correas y ruedas. */}
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <rect x="5" y="6" width="14" height="13" rx="2" />
      <path d="M9 10v5M15 10v5" />
      <path d="M8 21v-2M16 21v-2" />
    </svg>
  )
}
