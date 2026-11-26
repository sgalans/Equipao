import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { shareText } from '@/shared/lib/shareText'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CopyTextDialog } from '@/shared/ui/CopyTextDialog'
import { EditableTitle } from '@/shared/ui/EditableTitle'
import { PackedVisibilityIcon } from '@/shared/ui/icons/PackedVisibilityIcon'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import { ShareIcon } from '@/shared/ui/icons/ShareIcon'
import { useNotifications } from '@/shared/ui/notifications/notificationStore'
import page from '@/shared/ui/page.module.css'
import { formatLuggageText, toLuggageText } from '../domain/luggageText'
import { isFullyPacked, packingProgress } from '../domain/packing'
import { articles } from './addedSummary'
import { removedSummary } from './bulkSummary'
import { DeleteLuggageButton } from './DeleteLuggageButton'
import { LuggageDescription } from './LuggageDescription'
import { MoveItemsDialog } from './MoveItemsDialog'
import { PackingList } from './PackingList'
import styles from './LuggageDetailPage.module.css'
import {
  doneIds,
  isAllDoneHidden,
  usePackingOrder,
  useStoredHidden,
} from './packingOrderStore'
import { PackingProgress } from './PackingProgress'
import { ReadyListDialog } from './ReadyListDialog'

/** Pantalla /luggages/:luggageId: la lista de artículos de una maleta. */
export function LuggageDetailPage() {
  const { luggageId = '' } = useParams<{ luggageId: string }>()
  const { luggages, quantities, compartments } = useRepositories()
  const navigate = useNavigate()
  const show = useNotifications((state) => state.show)
  // Artículos listos ocultos con el ojo (ver packingOrderStore). useMemo:
  // el Set se crea solo cuando cambia lo guardado, no en cada render.
  const storedHidden = useStoredHidden(luggageId)
  const hidden = useMemo(
    () => storedHidden && new Set(storedHidden),
    [storedHidden],
  )
  const hide = usePackingOrder((state) => state.hide)
  const showAll = usePackingOrder((state) => state.show)
  // Último recurso de "Compartir": texto para copiar a mano (null = cerrado).
  const [manualShareText, setManualShareText] = useState<string | null>(null)
  // Ventana "Listos": ids listos al abrirla (null = cerrada).
  const [readyListIds, setReadyListIds] = useState<string[] | null>(null)

  // Modo selección: reorganizar la maleta (mover a un compartimento, a
  // sueltos o a uno nuevo) o quitar varios de golpe. Mover ENTRE maletas no
  // (decisión de producto): eso se hace desde el catálogo.
  const [isSelecting, setIsSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [dialog, setDialog] = useState<'move' | 'remove' | null>(null)

  function toggleSelected(quantityId: string) {
    // Inmutable: un Set NUEVO para que React detecte el cambio.
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(quantityId)) next.delete(quantityId)
      else next.add(quantityId)
      return next
    })
  }

  function exitSelection() {
    setIsSelecting(false)
    setSelected(new Set())
    setDialog(null)
  }

  // Tres estados distinguibles (getById devuelve undefined si no existe,
  // igual que useLiveQuery mientras carga; por eso lo convertimos a null):
  //   undefined → cargando · null → no existe · Luggage → listo
  const luggage = useLiveQuery(
    async () => (await luggages.getById(luggageId)) ?? null,
    [luggages, luggageId],
  )
  // Contenido y compartimentos en UN SOLO useLiveQuery. Con dos separados,
  // cada uno se refresca por su cuenta y, al borrar un compartimento, habría
  // un instante incoherente ("tearing"): el compartimento ya no está pero
  // sus artículos aún no aparecen como sueltos (un parpadeo en pantalla).
  // Juntos, siempre llegan de la misma instantánea de los datos.
  const contents = useLiveQuery(async () => {
    const [entries, compartmentList] = await Promise.all([
      quantities.listEntriesByLuggage(luggageId),
      compartments.listByLuggage(luggageId),
    ])
    return { entries, compartmentList }
  }, [quantities, compartments, luggageId])

  // OJO: todos los hooks van ANTES de los `return` tempranos. Las reglas de
  // los hooks exigen llamarlos siempre en el mismo orden en cada render.
  if (luggage === undefined || contents === undefined) {
    return <p aria-busy="true">Cargando maleta…</p>
  }

  if (luggage === null) {
    return (
      <section>
        <h1 className={page.title}>No encontramos esta maleta</h1>
        <p>Puede que se haya borrado.</p>
        <Link to="/">Volver a mis maletas</Link>
      </section>
    )
  }

  const { entries, compartmentList } = contents
  const doneNow = doneIds(entries, compartmentList)
  // Interruptor "Ocultar listos": sin nada hecho (artículos listos o
  // compartimentos completos) no hay botón; activado = todo lo hecho está
  // oculto. En modo selección, fuera (solo se eligen artículos).
  const showVisibilityToggle = !isSelecting && doneNow.size > 0
  const isHidingPacked = isAllDoneHidden(entries, compartmentList, hidden)

  /** Comparte la maleta como texto (hoja nativa de iOS o portapapeles). */
  async function share() {
    if (!luggage) return
    const text = formatLuggageText(
      toLuggageText(luggage.name, entries, compartmentList),
    )
    // shareText nunca lanza: prueba hoja nativa → portapapeles → 'manual'.
    const result = await shareText({ title: luggage.name, text })
    if (result === 'copied') show('Lista copiada. Pégala donde quieras.')
    if (result === 'manual') setManualShareText(text)
  }

  return (
    <section>
      <header className={page.header}>
        <EditableTitle
          // key: si cambiamos de maleta sin desmontar la página, el título
          // empieza de cero (sin un borrador de la maleta anterior).
          key={luggage.id}
          value={luggage.name}
          editLabel="Renombrar maleta"
          onSave={async (name) => {
            await luggages.update(luggage.id, { name })
          }}
        />
        <button
          type="button"
          className={buttons.iconGhost}
          aria-label="Compartir maleta"
          title="Compartir maleta"
          onClick={() => void share()}
        >
          <ShareIcon />
        </button>
      </header>
      <LuggageDescription
        // key: si cambia de maleta, el editor empieza de cero.
        key={luggage.id}
        value={luggage.description}
        onSave={async (description) => {
          await luggages.update(luggage.id, { description })
        }}
      />

      <PackingProgress
        {...packingProgress(entries, compartmentList)}
        onOpenDone={() =>
          setReadyListIds(
            entries.filter(isFullyPacked).map((entry) => entry.id),
          )
        }
      />
      {/* En modo selección solo se eligen artículos: fuera lo demás. */}
      {!isSelecting && (
        // ÚNICA forma de añadir (decisión de producto): la pantalla del
        // catálogo, donde se busca, se elige y se crea lo que falte.
        <Link
          to={`/luggages/${luggage.id}/add-items`}
          className={`${buttons.secondary} ${styles.addLink}`}
        >
          <PlusIcon />
          Añadir artículos
        </Link>
      )}
      {/* Acciones sobre la lista, justo encima de ella: ocultar listos y
          "Seleccionar". */}
      {entries.length > 0 && (
        <div className={styles.listToolbar}>
          {showVisibilityToggle && (
            <button
              type="button"
              className={`${buttons.iconGhost} ${styles.visibility}`}
              // El icono muestra el ESTADO ACTUAL, no lo que pasará al
              // tocarlo (decisión de producto): ojo abierto = los listos se
              // ven en la lista; ojo tachado = están ocultos (se consultan
              // en la ventana "Listos", tocando la barra de progreso).
              // Por eso es un interruptor: nombre fijo + aria-pressed, y
              // VoiceOver dice "Ocultar listos, botón, activado/desactivado".
              aria-label="Ocultar listos"
              title="Ocultar listos"
              aria-pressed={isHidingPacked}
              onClick={() =>
                isHidingPacked ? showAll(luggage.id) : hide(luggage.id, doneNow)
              }
            >
              <PackedVisibilityIcon crossed={isHidingPacked} />
            </button>
          )}
          <button
            type="button"
            className={buttons.headerAction}
            onClick={() =>
              isSelecting ? exitSelection() : setIsSelecting(true)
            }
          >
            {isSelecting ? 'Cancelar' : 'Seleccionar'}
          </button>
        </div>
      )}
      <PackingList
        luggageId={luggage.id}
        entries={entries}
        compartments={compartmentList}
        hidden={hidden}
        selection={
          isSelecting ? { selected, onToggle: toggleSelected } : undefined
        }
      />
      <CopyTextDialog
        text={manualShareText}
        onClose={() => setManualShareText(null)}
        onCopied={() => {
          setManualShareText(null)
          show('Lista copiada. Pégala donde quieras.')
        }}
      />
      <ReadyListDialog
        quantityIds={readyListIds}
        entries={entries}
        compartments={compartmentList}
        onClose={() => setReadyListIds(null)}
      />

      {isSelecting ? (
        // Barra fija abajo, al alcance del pulgar (como en el catálogo).
        <div className={styles.selectionBar}>
          <button
            type="button"
            className={buttons.primary}
            disabled={selected.size === 0}
            onClick={() => setDialog('move')}
          >
            Mover{selected.size > 0 && ` ${selected.size}`}…
          </button>
          <button
            type="button"
            className={buttons.secondary}
            disabled={selected.size === 0}
            onClick={() => setDialog('remove')}
          >
            Quitar{selected.size > 0 && ` ${selected.size}`}
          </button>
        </div>
      ) : (
        <footer className={styles.footer}>
          <DeleteLuggageButton
            luggage={luggage}
            // replace: la pantalla de una maleta borrada no queda en el
            // historial; "atrás" no lleva a una maleta que ya no existe.
            onDeleted={() => {
              // Lo oculto de una maleta borrada no sirve de nada: fuera de
              // localStorage, para no acumular basura.
              showAll(luggage.id)
              navigate('/', { replace: true })
            }}
          />
        </footer>
      )}

      <MoveItemsDialog
        open={dialog === 'move'}
        luggageId={luggage.id}
        quantityIds={[...selected]}
        compartments={compartmentList}
        onCancel={() => setDialog(null)}
        onMoved={exitSelection}
      />
      <ConfirmDialog
        open={dialog === 'remove'}
        title={`¿Quitar ${articles(selected.size)} de la maleta?`}
        confirmLabel="Quitar"
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          const count = selected.size
          await quantities.removeMany([...selected])
          show(removedSummary(count))
          exitSelection()
        }}
      >
        <p>Siguen en tu catálogo.</p>
      </ConfirmDialog>
    </section>
  )
}
