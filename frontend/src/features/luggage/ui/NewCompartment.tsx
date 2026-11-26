import { useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { DuplicateError } from '@/shared/domain/errors'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import buttons from '@/shared/ui/buttons.module.css'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import { InlineEditInput } from '@/shared/ui/InlineEditInput'
import styles from './NewCompartment.module.css'

interface NewCompartmentProps {
  luggageId: string
  /** Si la maleta aún no tiene compartimentos, se explica qué son. */
  showHelp: boolean
}

/** "+ Nuevo compartimento" → se convierte en un campo → OK lo crea. */
export function NewCompartment({ luggageId, showHelp }: NewCompartmentProps) {
  const { compartments } = useRepositories()
  const [isCreating, setIsCreating] = useState(false)
  // Motivo por el que no se pudo crear (junto al botón, no un aviso global).
  const [error, setError] = useState<string | null>(null)

  async function create(name: string | null) {
    setIsCreating(false)
    // Cancelado o vacío: simplemente no se crea nada.
    if (!name) return
    try {
      await compartments.create({ luggageId, name })
    } catch (e) {
      // Reglas del modelo (no son fallos): ya hay uno igual en la maleta, o
      // ese nombre es de un artículo normal del catálogo. Se explica aquí.
      if (e instanceof DuplicateError) setError(`${e.message}.`)
      else reportError(e)
    }
  }

  return (
    <div className={styles.wrapper}>
      {isCreating ? (
        <InlineEditInput
          ariaLabel="Nombre del nuevo compartimento"
          placeholder="Neceser, mochila de mano…"
          onFinish={(name) => void create(name)}
        />
      ) : (
        <button
          type="button"
          className={`${buttons.secondary} ${styles.button}`}
          onClick={() => {
            setError(null)
            setIsCreating(true)
          }}
        >
          <PlusIcon />
          Nuevo compartimento
        </button>
      )}

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {showHelp && (
        // Texto acordado con producto (ver CLAUDE.md, vocabulario).
        <p className={styles.help}>
          Contenedor para meter artículos, como un neceser, una mochila o un
          maletín.
        </p>
      )}
    </div>
  )
}
