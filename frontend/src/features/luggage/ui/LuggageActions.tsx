import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { shareText } from '@/shared/lib/shareText'
import { ActionSheet, type SheetAction } from '@/shared/ui/ActionSheet'
import buttons from '@/shared/ui/buttons.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CopyTextDialog } from '@/shared/ui/CopyTextDialog'
import { CopyIcon } from '@/shared/ui/icons/CopyIcon'
import { MoreIcon } from '@/shared/ui/icons/MoreIcon'
import { SelectItemsIcon } from '@/shared/ui/icons/SelectItemsIcon'
import { ShareIcon } from '@/shared/ui/icons/ShareIcon'
import { TrashIcon } from '@/shared/ui/icons/TrashIcon'
import {
  reportError,
  useNotifications,
} from '@/shared/ui/notifications/notificationStore'
import type { Luggage } from '../domain/luggage'
import { formatLuggageText, toLuggageText } from '../domain/luggageText'
import { usePackingOrder } from './packingOrderStore'

interface LuggageActionsProps {
  luggage: Pick<Luggage, 'id' | 'name'>
  /** Tras duplicar, con la copia (el listado la resalta; la maleta la abre). */
  onDuplicated: (copy: Luggage) => void
  /** Tras borrar (la página decide adónde ir). */
  onDeleted: () => void
  /** Solo dentro de la maleta: "Seleccionar artículos" (mover/quitar varios). */
  onSelectItems?: () => void
}

/**
 * Botón ⋯ de una maleta + su hoja de acciones (decisión del usuario): el
 * MISMO en el listado y en la cabecera de la maleta. Duplicar, Compartir y
 * Borrar maleta (y, dentro, Seleccionar artículos). Aquí irían también
 * "Reiniciar" o "Archivar" (backlog).
 */
export function LuggageActions({
  luggage,
  onDuplicated,
  onDeleted,
  onSelectItems,
}: LuggageActionsProps) {
  const { luggages, quantities, compartments } = useRepositories()
  const show = useNotifications((state) => state.show)
  const showAllPacked = usePackingOrder((state) => state.show)
  const [isOpen, setIsOpen] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  // Último recurso de "Compartir": texto para copiar a mano (null = cerrado).
  const [manualText, setManualText] = useState<string | null>(null)

  // El texto para compartir (y cuántos artículos se borrarían) se prepara
  // al ABRIR el ⋯, no al tocar "Compartir": Safari solo abre la hoja de
  // compartir justo después de un toque (transient user activation) y una
  // lectura de IndexedDB por medio podría hacer que la rechazara. Solo se
  // consulta con la hoja o la confirmación abiertas: el listado no lee el
  // contenido de todas las maletas.
  async function prepare() {
    const [entries, compartmentList] = await Promise.all([
      quantities.listEntriesByLuggage(luggage.id),
      compartments.listByLuggage(luggage.id),
    ])
    return {
      text: formatLuggageText(
        toLuggageText(luggage.name, entries, compartmentList),
      ),
      itemCount: entries.length,
    }
  }
  const prepared = useLiveQuery(async () => {
    if (!isOpen && !isConfirmingDelete) return null
    return prepare()
    // Dependencias: lo que usa prepare() y cuándo se consulta.
  }, [
    isOpen,
    isConfirmingDelete,
    quantities,
    compartments,
    luggage.id,
    luggage.name,
  ])

  async function duplicate() {
    // Evita dos copias por un doble toque mientras se guarda.
    if (isDuplicating) return
    setIsDuplicating(true)
    try {
      onDuplicated(await luggages.duplicate(luggage.id))
    } catch (error) {
      reportError(error)
    } finally {
      setIsDuplicating(false)
    }
  }

  async function share() {
    try {
      // Normalmente ya está preparado; si se toca antes de que acabe la
      // lectura (muy raro), se calcula ahora (en el peor caso, Safari pasa
      // a la alternativa del portapapeles o la de copiar a mano).
      const text = prepared?.text ?? (await prepare()).text
      // shareText nunca lanza: hoja nativa → portapapeles → 'manual'.
      const result = await shareText({ title: luggage.name, text })
      if (result === 'copied') show('Lista copiada. Pégala donde quieras.')
      if (result === 'manual') setManualText(text)
    } catch (error) {
      reportError(error)
    }
  }

  const actions: SheetAction[] = [
    ...(onSelectItems
      ? [
          {
            label: 'Seleccionar artículos',
            icon: <SelectItemsIcon />,
            onSelect: onSelectItems,
          },
        ]
      : []),
    {
      label: 'Duplicar',
      icon: <CopyIcon />,
      onSelect: () => void duplicate(),
    },
    { label: 'Compartir', icon: <ShareIcon />, onSelect: () => void share() },
    {
      label: 'Borrar maleta',
      icon: <TrashIcon />,
      variant: 'danger',
      onSelect: () => setIsConfirmingDelete(true),
    },
  ]

  return (
    <>
      <button
        type="button"
        className={buttons.iconGhost}
        // Con el nombre: con varias maletas, VoiceOver necesita saber de
        // CUÁL son las acciones.
        aria-label={`Acciones de ${luggage.name}`}
        aria-haspopup="dialog"
        title="Más acciones"
        onClick={() => setIsOpen(true)}
      >
        <MoreIcon />
      </button>

      <ActionSheet
        open={isOpen}
        title={luggage.name}
        actions={actions}
        onClose={() => setIsOpen(false)}
      />

      <ConfirmDialog
        open={isConfirmingDelete}
        title={`¿Borrar «${luggage.name}»?`}
        confirmLabel="Borrar"
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={async () => {
          await luggages.remove(luggage.id)
          // Lo oculto con el ojo de una maleta borrada no sirve de nada:
          // fuera de localStorage, para no acumular basura.
          showAllPacked(luggage.id)
          setIsConfirmingDelete(false)
          onDeleted()
        }}
      >
        <p>{describeCascade(prepared?.itemCount)}</p>
        <p>Esta acción no se puede deshacer.</p>
      </ConfirmDialog>

      <CopyTextDialog
        text={manualText}
        onClose={() => setManualText(null)}
        onCopied={() => {
          setManualText(null)
          show('Lista copiada. Pégala donde quieras.')
        }}
      />
    </>
  )
}

/**
 * Explica qué se borra y, sobre todo, qué NO: los artículos del catálogo
 * (Item) son independientes de las maletas; solo se borra la lista de esta
 * maleta (ItemQuantity). Si está vacía, no hace falta mencionarlo.
 */
function describeCascade(itemCount: number | undefined): string {
  if (!itemCount) return 'Se borrará la maleta.'
  const list =
    itemCount === 1
      ? 'su lista (1 artículo)'
      : `su lista (${itemCount} artículos)`
  return `Se borrarán la maleta y ${list}. Los artículos de tu catálogo no se borran.`
}
