// Setup solo para tests de componentes (proyecto 'dom', entorno jsdom).

// Añade matchers de DOM a `expect` (toBeInTheDocument, toHaveTextContent…).
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library solo desmonta automáticamente los componentes si Vitest
// expone `afterEach` como global. Como no usamos globals, lo hacemos a mano
// para que el DOM de un test no se filtre al siguiente.
afterEach(() => {
  cleanup()
})
