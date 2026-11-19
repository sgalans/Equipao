import { useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import { CopyIcon } from '@/shared/ui/icons/CopyIcon'
import type { Luggage } from '../domain/luggage'

interface DuplicateLuggageButtonProps {
  luggage: Pick<Luggage, 'id' | 'name'>
  /** Recibe la copia recién creada (el listado la resalta). */
  onDuplicated: (copy: Luggage) => void
}

/**
 * Botón ⧉ de cada maleta en el listado. Sin confirmación: duplicar no
 * destruye nada, y si sobra la copia se borra.
 */
export function DuplicateLuggageButton({
  luggage,
  onDuplicated,
}: DuplicateLuggageButtonProps) {
  const { luggages } = useRepositories()
  // Evita crear dos copias por un doble toque mientras se guarda.
  const [isDuplicating, setIsDuplicating] = useState(false)

  async function duplicate() {
    if (isDuplicating) return
    setIsDuplicating(true)
    try {
      onDuplicated(await luggages.duplicate(luggage.id))
    } catch (error) {
      console.error(error)
    } finally {
      setIsDuplicating(false)
    }
  }

  return (
    <button
      type="button"
      className={buttons.iconGhost}
      // Incluye el nombre: con varias maletas, VoiceOver necesita saber
      // CUÁL duplica cada botón ("Duplicar Mochila").
      aria-label={`Duplicar ${luggage.name}`}
      title="Duplicar"
      disabled={isDuplicating}
      onClick={() => void duplicate()}
    >
      <CopyIcon />
    </button>
  )
}
