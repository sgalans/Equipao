/**
 * Icono del interruptor "Ocultar listos": un ojo (visibilidad) con un check
 * en la esquina (lo listo). Muestra el ESTADO: sin tachar = los listos se
 * ven; tachado = están ocultos. Ni el ojo solo (no dice QUÉ se oculta) ni un check tachado
 * (parecería "desmarcar") se explicaban por sí solos.
 * Ver TrashIcon para las notas de accesibilidad.
 */
export function PackedVisibilityIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Ojo, arriba a la izquierda (deja la esquina para el check). */}
      <path d="M1.5 9.5s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
      <circle cx="9.5" cy="9.5" r="2.5" />
      {crossed && <path d="M2.5 2.5l14 14" />}
      {/* Check de "listo", abajo a la derecha. */}
      <path d="M14.5 19.5l2.5 2.5 5-5.5" />
    </svg>
  )
}
