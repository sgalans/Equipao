import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

// Smoke test: comprueba que la cadena de tests (Vitest + jsdom + Testing
// Library) funciona de punta a punta. Testing Library busca por rol y texto,
// como lo haría un usuario, en lugar de por clases CSS o detalles internos.
describe('App', () => {
  it('muestra el nombre de la aplicación', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'LugGAge' })).toBeInTheDocument()
  })
})
