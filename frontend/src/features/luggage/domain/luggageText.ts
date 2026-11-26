import { isSameItemName } from '@/features/items/domain/itemName'
import type { Compartment } from './compartment'
import type { LuggageEntry } from './itemQuantityRepository'

/**
 * Maleta como TEXTO, para compartirla (WhatsApp, Notas, AirDrop) e
 * importarla (decisión de producto). Funciones puras: sin base de datos ni
 * React, testeables con una línea cada caso.
 *
 * Formato (legible en WhatsApp y a la vez parseable):
 *
 *   🧳 Mallorca
 *
 *   - Camisetas ×3
 *   - Bañador
 *
 *   Neceser:
 *   - Cepillo de dientes
 *
 * - "🧳 " + nombre = la maleta. "Nombre:" = un compartimento. "- " = un
 *   artículo; " ×3" = cantidad (solo si es más de 1).
 * - NO incluye qué está ya listo (la maleta importada empieza sin nada
 *   guardado, como al duplicar) ni la descripción (decisión del usuario).
 */

/** Un artículo del texto: nombre y cantidad. */
export interface TextItem {
  name: string
  num: number
}

/** La maleta tal como viaja en el texto (sin ids: es un formato de intercambio). */
export interface LuggageText {
  /** null = el texto no traía nombre (lista sin "🧳"). */
  name: string | null
  loose: TextItem[]
  compartments: { name: string; items: TextItem[] }[]
}

const LUGGAGE_MARK = '🧳'
/** Mismos límites que el dominio (NameSchema, cantidad de PackingListRow). */
const MAX_NAME = 100
const MAX_UNITS = 99

function formatItem(item: TextItem): string {
  return item.num > 1 ? `- ${item.name} ×${item.num}` : `- ${item.name}`
}

/** Maleta → texto para compartir. */
export function formatLuggageText(luggage: LuggageText): string {
  const blocks: string[] = []
  if (luggage.name !== null) blocks.push(`${LUGGAGE_MARK} ${luggage.name}`)
  if (luggage.loose.length > 0) {
    blocks.push(luggage.loose.map(formatItem).join('\n'))
  }
  for (const compartment of luggage.compartments) {
    blocks.push(
      [`${compartment.name}:`, ...compartment.items.map(formatItem)].join('\n'),
    )
  }
  // Una línea en blanco entre bloques: se lee bien en el chat.
  return blocks.join('\n\n')
}

/** Una maleta de la app → su forma de texto (en el orden de la maleta). */
export function toLuggageText(
  name: string,
  entries: LuggageEntry[],
  compartments: Compartment[],
): LuggageText {
  const toItem = (entry: LuggageEntry): TextItem => ({
    name: entry.itemName,
    num: entry.num,
  })
  return {
    name,
    loose: entries.filter((e) => e.compartmentId === null).map(toItem),
    compartments: compartments.map((c) => ({
      name: c.name,
      items: entries.filter((e) => e.compartmentId === c.id).map(toItem),
    })),
  }
}

/** Viñetas aceptadas al importar (listas escritas a mano o de otras apps). */
const BULLET = /^[-–—•·*]\s*/
/** Cantidad al final ("Calcetines ×3", "Calcetines x 3")… */
const QUANTITY_SUFFIX = /\s*[×xX]\s*(\d+)$/
/** …o al principio ("3 × Calcetines", "3x Calcetines"). */
const QUANTITY_PREFIX = /^(\d+)\s*[×xX]\s+/

function clampUnits(raw: string): number {
  return Math.min(Math.max(Number(raw), 1), MAX_UNITS)
}

/** Una línea de artículo → nombre y cantidad (null si no queda nombre). */
function parseItem(line: string): TextItem | null {
  let text = line.replace(BULLET, '')
  let num = 1
  const suffix = QUANTITY_SUFFIX.exec(text)
  const prefix = QUANTITY_PREFIX.exec(text)
  if (suffix) {
    num = clampUnits(suffix[1])
    text = text.slice(0, suffix.index)
  } else if (prefix) {
    num = clampUnits(prefix[1])
    text = text.slice(prefix[0].length)
  }
  const name = text.trim().slice(0, MAX_NAME)
  return name === '' ? null : { name, num }
}

/**
 * Texto → maleta. TOLERANTE (decisión de producto): además del formato
 * propio, acepta una lista cualquiera, una cosa por línea, con o sin
 * viñetas. Las reglas:
 * - "🧳 Nombre" = nombre de la maleta (sin esa línea, name = null);
 * - una línea que acaba en ":" (sin viñeta) = empieza un compartimento;
 * - cualquier otra línea no vacía = un artículo del bloque actual.
 * Un artículo repetido (mismo nombre sin mirar mayúsculas ni tildes) solo
 * cuenta la primera vez: en una maleta cada artículo ocupa un solo sitio.
 */
export function parseLuggageText(text: string): LuggageText {
  const result: LuggageText = { name: null, loose: [], compartments: [] }
  const seen: string[] = []
  let current = result.loose

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') continue

    if (line.startsWith(LUGGAGE_MARK)) {
      const name = line.slice(LUGGAGE_MARK.length).trim().slice(0, MAX_NAME)
      // Solo el primero: un segundo "🧳" no cambia el nombre.
      if (result.name === null && name !== '') result.name = name
      continue
    }

    if (line.endsWith(':') && !BULLET.test(line)) {
      const name = line.slice(0, -1).trim().slice(0, MAX_NAME)
      if (name !== '') {
        const compartment = { name, items: [] as TextItem[] }
        result.compartments.push(compartment)
        current = compartment.items
      }
      continue
    }

    const item = parseItem(line)
    if (item && !seen.some((name) => isSameItemName(name, item.name))) {
      seen.push(item.name)
      current.push(item)
    }
  }
  return result
}

/** ¿Trae algo que importar? (para desactivar "Crear maleta"). */
export function isEmptyLuggageText(luggage: LuggageText): boolean {
  return (
    luggage.loose.length === 0 &&
    luggage.compartments.length === 0 &&
    luggage.name === null
  )
}
