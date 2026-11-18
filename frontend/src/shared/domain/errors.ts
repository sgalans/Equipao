/**
 * Errores de dominio. Los repositorios traducen los errores técnicos (de
 * Dexie, y en la fase 2 de HTTP) a estos, para que la UI pueda reaccionar con
 * `instanceof` sin conocer la tecnología de persistencia.
 *
 * Asignamos `name` a mano (y no con this.constructor.name) porque al
 * minificar el build los nombres de las clases cambian.
 */
export class DomainError extends Error {}

/**
 * No existe la entidad buscada (equivale a un 404).
 *
 * OJO: no se llama "NotFoundError" a propósito. Ese es el nombre de un error
 * estándar de IndexedDB y Dexie, al ver un error con ese `name` salir de una
 * transacción, lo convierte en su propio Dexie.NotFoundError (perdemos la
 * clase y el campo `entity`). Los nombres de nuestros errores no deben
 * coincidir con los de DOMException / Dexie.
 */
export class EntityNotFoundError extends DomainError {
  readonly entity: string
  readonly id: string

  constructor(entity: string, id: string) {
    super(`${entity} con id ${id} no existe`)
    this.name = 'EntityNotFoundError'
    this.entity = entity
    this.id = id
  }
}

/** Violación de unicidad (equivale a un UNIQUE de SQL / 409 Conflict). */
export class DuplicateError extends DomainError {
  // `cause` (estándar de ES2022) conserva el error técnico original para
  // depurar, sin que la UI tenga que conocerlo.
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DuplicateError'
  }
}

/** Borrado impedido porque otras filas lo referencian (ON DELETE RESTRICT). */
export class InUseError extends DomainError {
  readonly entity: string
  readonly id: string
  readonly usages: number

  constructor(entity: string, id: string, usages: number) {
    super(`${entity} con id ${id} está en uso en ${usages} sitio(s)`)
    this.name = 'InUseError'
    this.entity = entity
    this.id = id
    this.usages = usages
  }
}

/**
 * Los datos violarían una invariante entre entidades, p. ej. meter un
 * artículo en un compartimento de OTRA maleta. Es un error de programación
 * o de datos corruptos, no algo que el usuario pueda provocar desde la UI.
 */
export class ConsistencyError extends DomainError {
  constructor(message: string) {
    super(message)
    this.name = 'ConsistencyError'
  }
}
