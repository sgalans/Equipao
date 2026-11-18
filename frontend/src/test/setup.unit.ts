// Setup común a todos los tests (se ejecuta antes de cada fichero de test).

// Sustituye IndexedDB por una implementación en memoria: los tests de la capa
// de datos corren en Node, sin navegador, y cada ejecución empieza limpia.
import 'fake-indexeddb/auto'
