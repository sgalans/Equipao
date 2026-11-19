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

// jsdom no implementa los métodos de <dialog> (showModal/close). Stub mínimo
// que imita lo que hace el navegador: activar/desactivar el atributo `open`
// (jsdom ya oculta un <dialog> cerrado) y lanzar el evento `close`.
// Limitación consciente: el foco atrapado y Escape son del navegador real y
// no se prueban aquí (se cubrirían con tests E2E, p. ej. Playwright).
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    if (!this.open) return
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}

// Higiene entre tests: localStorage (p. ej. el plegado de compartimentos
// que persiste Zustand) no debe filtrarse de un test a otro.
afterEach(() => {
  localStorage.clear()
})
