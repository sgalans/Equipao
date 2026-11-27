/**
 * Resultado de compartir: la UI decide qué hacer en cada caso.
 * - 'shared': se abrió la hoja nativa y se compartió.
 * - 'copied': no había hoja (o falló) y se copió al portapapeles.
 * - 'cancelled': el usuario cerró la hoja; no hay que decir nada.
 * - 'manual': ni hoja ni portapapeles; la UI debe mostrar el texto para
 *   copiarlo a mano (último recurso: compartir NUNCA se queda sin salida).
 */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'manual'

/** Lo que usamos de `navigator` (inyectable: los tests pasan uno falso). */
type ShareNavigator = Partial<Pick<Navigator, 'share' | 'clipboard'>>

/**
 * Comparte un texto con una cadena de alternativas (patrón "graceful
 * degradation"): 1) la HOJA NATIVA de compartir (Web Share API: en iOS,
 * WhatsApp, Notas, AirDrop…); 2) el portapapeles; 3) 'manual'.
 *
 * Por qué tantas: las dos APIs solo existen en contextos SEGUROS (HTTPS o
 * localhost). En el iPhone contra `npm run dev -- --host` (http://192.168…)
 * no hay ninguna. Y Safari puede rechazar la hoja (NotAllowedError) si no
 * considera la llamada fruto directo de un toque.
 *
 * Nunca lanza: cancelar la hoja (AbortError) es 'cancelled', y cualquier
 * otro fallo pasa a la siguiente alternativa.
 */
export async function shareText(
  { title, text }: { title: string; text: string },
  nav: ShareNavigator = navigator,
): Promise<ShareResult> {
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title, text })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
      // Otro fallo: se registra y se prueba la siguiente vía.
      console.warn('No se pudo abrir la hoja de compartir', error)
    }
  }
  if (typeof nav.clipboard?.writeText === 'function') {
    try {
      await nav.clipboard.writeText(text)
      return 'copied'
    } catch (error) {
      console.warn('No se pudo copiar al portapapeles', error)
    }
  }
  return 'manual'
}
