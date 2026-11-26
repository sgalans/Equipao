import buttons from '@/shared/ui/buttons.module.css'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import styles from './CreateAsCompartment.module.css'

interface CreateAsCompartmentProps {
  /** Nombre escrito en "Buscar o crear" (nuevo: aún no está en el catálogo). */
  name: string
  onCreate: () => void
}

/**
 * Segunda forma de crear desde "Buscar o crear": el "+" crea un artículo y
 * esto, un COMPARTIMENTO (un contenedor: Neceser, Mochila…). Hace falta en
 * el momento de crearlo porque, una vez en una maleta, ya no se puede
 * convertir (decisión del usuario, opción A). Solo aparece con un nombre
 * nuevo, así que no ocupa sitio mientras se busca algo que ya existe.
 */
export function CreateAsCompartment({
  name,
  onCreate,
}: CreateAsCompartmentProps) {
  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={buttons.textAction}
        // Como el "+": que el toque no cierre el teclado de iOS antes de crear.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onCreate}
      >
        <PlusIcon />
        Crear «{name}» como compartimento
      </button>
      {/* Texto de ayuda acordado (CLAUDE.md, vocabulario). */}
      <p className={styles.help}>
        Contenedor para meter artículos, como un neceser, una mochila o un
        maletín.
      </p>
    </div>
  )
}
