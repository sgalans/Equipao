/**
 * Nombre visible de la app: un único sitio (single source of truth). Lo usan
 * la cabecera y, con la PWA, el manifest.
 *
 * OJO: NO confundir con identificadores internos como el nombre de la base
 * de datos ('luggage-app') o las claves de localStorage. Esos NO deben
 * cambiar aunque cambie el nombre: un nombre de BD nuevo = BD nueva y vacía
 * (el usuario perdería sus datos).
 */
export const APP_NAME = 'Equipao'
