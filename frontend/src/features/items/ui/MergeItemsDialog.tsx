import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import type { PendingMerge } from './useItemRename'

/**
 * Confirmación de UNIR dos artículos (ver useItemRename): irreversible, así
 * que se pregunta explicando qué quedará.
 */
export function MergeItemsDialog({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingMerge | null
  onConfirm: () => Promise<void>
  onCancel: () => void
}) {
  const target = pending?.target.name ?? ''
  return (
    <ConfirmDialog
      open={pending !== null}
      title={`Ya existe «${target}»`}
      confirmLabel="Unir"
      confirmVariant="primary"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p>
        ¿Unir «{pending?.sourceName}» con «{target}»? Quedará solo «{target}»,
        en todas las maletas.
      </p>
    </ConfirmDialog>
  )
}
