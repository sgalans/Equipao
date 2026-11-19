import { useCallback, useEffect, useState } from 'react'

/** Lo que dura el resaltado (coincide con la animación de highlight.module.css). */
const HIGHLIGHT_MS = 2000

/**
 * Resalta un elemento (p. ej. la fila de un artículo que ya existía, o la
 * copia recién creada) durante unos segundos y lo "apaga" solo.
 *
 * Hook propio (custom hook): el mismo estado + temporizador estaba copiado en
 * varias pantallas; extraerlo es DRY y el temporizador se limpia siempre.
 */
export function useTemporaryHighlight(): {
  highlightedId: string | null
  highlight: (id: string | null) => void
} {
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  useEffect(() => {
    if (!highlightedId) return
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS)
    // Limpieza: si se desmonta o cambia antes de tiempo, no queda un
    // temporizador "huérfano" que actualice un componente que ya no existe.
    return () => clearTimeout(timer)
  }, [highlightedId])

  // useCallback: función estable entre renders, segura como dependencia.
  const highlight = useCallback((id: string | null) => setHighlightedId(id), [])
  return { highlightedId, highlight }
}
