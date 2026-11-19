import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

/** Fondo del icono (el mismo que el del dibujo de public/icon.svg). */
const ICON_BACKGROUND = '#e8eef9'

/**
 * Iconos de la PWA generados a partir de UN SOLO SVG (public/icon.svg):
 * favicon, 64/192/512 px, el "maskable" de Android y el apple-touch-icon
 * de iOS (180 px). Se generan en cada build: para cambiar el icono basta con
 * editar el SVG.
 *
 * El preset por defecto añade margen (pensado para logos con fondo
 * transparente) y en iOS saldría el dibujo pequeño dentro de un icono
 * blanco. Nuestro SVG ya trae el fondo a sangre y el dibujo centrado (dentro
 * de la "zona segura" que recortan iOS y Android), así que sin margen.
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: ICON_BACKGROUND },
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background: ICON_BACKGROUND },
    },
  },
  images: ['public/icon.svg'],
})
