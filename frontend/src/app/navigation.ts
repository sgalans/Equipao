import type { Params } from 'react-router'

/**
 * Adónde lleva el botón "‹" de la cabecera desde una ruta. Cada ruta puede
 * declararlo en su `handle` (mecanismo estándar de React Router para
 * adjuntar datos a una ruta); si no, se vuelve al inicio.
 *
 * Sigue siendo navegación jerárquica ("hacia arriba", nunca navigate(-1)):
 * desde "Añadir varios" el nivel superior es la maleta, no el inicio.
 */
export interface BackLink {
  to: string
  label: string
}

export interface RouteHandle {
  back?: (params: Params) => BackLink
}

export const HOME_BACK_LINK: BackLink = { to: '/', label: 'Mis maletas' }
