import { useLayoutEffect, useRef } from 'react'

/**
 * Un <textarea> que CRECE con su texto (decisión del usuario: editar una
 * descripción larga en una ventanita de 3 líneas era muy incómodo). Lo usan
 * la descripción de la maleta (InlineEditInput) y "Nueva maleta".
 *
 * Ajusta la altura a la del contenido cada vez que cambia el texto, antes
 * de pintar (useLayoutEffect: sin un parpadeo con la altura vieja). La
 * propiedad CSS `field-sizing: content` lo haría sola, pero Safari aún no la
 * admite: cuando lo haga, se cambia aquí y en ningún sitio más. jsdom no mide
 * alturas: esto se comprueba en el iPhone.
 *
 * Quien lo usa pone en su CSS `resize: none; overflow: hidden;` (ni asa de
 * redimensionar ni scroll dentro del campo: se desplaza la página).
 */
export function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const textarea = ref.current
    if (!textarea) return
    // 'auto' primero: si no, al borrar texto nunca encogería.
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  return ref
}
