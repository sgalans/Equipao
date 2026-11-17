// Añade matchers de DOM a `expect` (toBeInTheDocument, toHaveTextContent…).
import '@testing-library/jest-dom/vitest'
// Sustituye IndexedDB por una implementación en memoria: los tests de la capa
// de datos corren en Node, sin navegador, y cada ejecución empieza limpia.
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library solo desmonta automáticamente los componentes si Vitest
// expone `afterEach` como global. Como no usamos globals, lo hacemos a mano
// para que el DOM de un test no se filtre al siguiente.
afterEach(() => {
  cleanup()
})
