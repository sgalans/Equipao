import buttons from '@/shared/ui/buttons.module.css'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import styles from './CreateChoice.module.css'

interface CreateChoiceProps {
  /** Nombre escrito en "Buscar o crear" (ya recortado). */
  name: string
  /**
   * Si se puede crear: hay un nombre y no está ya en el catálogo. Si no,
   * los botones se ven atenuados y no se pueden pulsar.
   */
  canCreate: boolean
  onCreateItem: () => void
  /** Sin él (p. ej. al añadir DENTRO de un compartimento), solo "Artículo". */
  onCreateCompartment?: () => void
  /** Explicar qué es un compartimento (si aún no tienes ninguno). */
  showHelp?: boolean
}

/** Que el toque no quite el foco del campo: en iOS cerraría el teclado. */
const keepInputFocus = (event: React.MouseEvent) => event.preventDefault()

/**
 * Crear desde "Buscar o crear" (decisión del usuario): DOS botones iguales,
 * uno al lado del otro: "+ Artículo" y "+ Compartimento". SIEMPRE visibles
 * (decisión del usuario): sin un nombre nuevo están atenuados y no se pueden
 * pulsar; así, al escribir, no aparecen de la nada empujando la lista. Mismo estilo y tamaño, porque
 * son dos variantes de lo mismo (crear). Con texto y no solo iconos: en iOS
 * no hay tooltip y dos "+" parecidos obligarían a adivinar.
 *
 * Hay que elegir AL CREAR porque, ya en una maleta, un artículo no se puede
 * convertir en compartimento (opción A).
 */
export function CreateChoice({
  name,
  canCreate,
  onCreateItem,
  onCreateCompartment,
  showHelp = false,
}: CreateChoiceProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        {/* Texto visible corto (cabe en 375 px); el nombre accesible lo
            contiene entero (WCAG 2.5.3, "label in name"). */}
        <button
          type="button"
          className={buttons.secondary}
          aria-label={canCreate ? `Crear «${name}» como artículo` : undefined}
          disabled={!canCreate}
          onMouseDown={keepInputFocus}
          onClick={onCreateItem}
        >
          <PlusIcon />
          Artículo
        </button>
        {onCreateCompartment && (
          <button
            type="button"
            className={buttons.secondary}
            aria-label={
              canCreate ? `Crear «${name}» como compartimento` : undefined
            }
            disabled={!canCreate}
            onMouseDown={keepInputFocus}
            onClick={onCreateCompartment}
          >
            <PlusIcon />
            Compartimento
          </button>
        )}
      </div>
      {showHelp && onCreateCompartment && (
        // Texto de ayuda acordado (CLAUDE.md, vocabulario).
        <p className={styles.help}>
          Compartimento: contenedor para meter artículos, como un neceser, una
          mochila o un maletín.
        </p>
      )}
    </div>
  )
}
