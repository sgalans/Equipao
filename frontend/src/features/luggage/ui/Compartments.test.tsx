import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'
import { createTestRepositories } from '@/test/repositories'

type Repos = ReturnType<typeof createTestRepositories>

/** Abre una maleta "Grande" tras preparar datos con `arrange`. */
async function openLuggage(
  arrange?: (repos: Repos, luggageId: string) => Promise<void>,
) {
  const repositories = createTestRepositories()
  const luggage = await repositories.luggages.create({ name: 'Grande' })
  await arrange?.(repositories, luggage.id)
  const rendered = renderApp(`/luggages/${luggage.id}`, repositories)
  await screen.findByRole('heading', { name: 'Grande', level: 1 })
  return { ...rendered, repositories, luggage, user: userEvent.setup() }
}

/** Añade un artículo (suelto o en un compartimento). */
async function addItem(
  repos: Repos,
  luggageId: string,
  name: string,
  options: { compartmentId?: string; packed?: boolean } = {},
) {
  const item = await repos.items.create({ name })
  return repos.quantities.add({
    luggageId,
    itemId: item.id,
    compartmentId: options.compartmentId ?? null,
    num: 1,
    nAlreadyPacked: options.packed ? 1 : 0,
  })
}

describe('Crear compartimentos', () => {
  it('la maleta ya no tiene "Nuevo compartimento": se añaden desde "Añadir artículos"', async () => {
    await openLuggage()

    expect(
      screen.queryByRole('button', { name: 'Nuevo compartimento' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Añadir a la maleta' }),
    ).toBeInTheDocument()
  })
})

describe('Secciones', () => {
  it('los sueltos van arriba y cada compartimento muestra su progreso', async () => {
    await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Cepillo', {
        compartmentId: kit.id,
        packed: true,
      })
      await addItem(repos, luggageId, 'Pasta', { compartmentId: kit.id })
      await addItem(repos, luggageId, 'Pasaporte')
    })

    // Orden en pantalla: primero el suelto, después los del compartimento.
    const names = screen
      .getAllByRole('checkbox')
      .map((checkbox) => checkbox.getAttribute('aria-label'))
    // El compartimento tiene su propio círculo ("Neceser listo").
    expect(names).toEqual(['Pasaporte', 'Neceser listo', 'Cepillo', 'Pasta'])

    expect(
      screen.getByRole('button', { name: 'Neceser, 1 de 2' }),
    ).toBeInTheDocument()
  })

  it('tener todos sus artículos guardados NO lo marca como listo: solo la marca lo hace', async () => {
    await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Cepillo', {
        compartmentId: kit.id,
        packed: true,
      })
    })

    expect(
      screen.getByRole('button', { name: 'Neceser, 1 de 1' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Neceser listo' }),
    ).not.toBeChecked()
  })
})

describe('Plegar (estado de UI persistido con Zustand)', () => {
  it('un toque pliega y oculta sus artículos; otro lo despliega', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Cepillo', { compartmentId: kit.id })
    })
    const toggle = screen.getByRole('button', { name: /^Neceser,/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('checkbox', { name: 'Cepillo' }),
    ).not.toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByRole('checkbox', { name: 'Cepillo' })).toBeVisible()
  })

  it('sigue plegado al salir de la maleta y volver', async () => {
    const { user, luggage, repositories } = await openLuggage(
      async (repos, luggageId) => {
        await repos.compartments.create({ luggageId, name: 'Neceser' })
      },
    )
    await user.click(screen.getByRole('button', { name: /^Neceser,/ }))

    // Salir al inicio y volver a entrar (la página se desmonta y se monta).
    await user.click(screen.getByRole('link', { name: 'Mis maletas' }))
    await user.click(await screen.findByRole('link', { name: /^Grande,/ }))

    expect(
      await screen.findByRole('button', { name: /^Neceser,/ }),
    ).toHaveAttribute('aria-expanded', 'false')
    // Y queda guardado en localStorage con el id de ESE compartimento
    // (sobreviviría a cerrar la app).
    const [kit] = await repositories.compartments.listByLuggage(luggage.id)
    const stored = JSON.parse(
      localStorage.getItem('luggage-app:collapsed-compartments') ?? '{}',
    ) as { state: { collapsed: Record<string, true> } }
    expect(stored.state.collapsed).toEqual({ [kit.id]: true })
  })
})

describe('Renombrar y borrar compartimentos', () => {
  it('las acciones están ocultas hasta tocar ⋯, y otro toque las oculta', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await repos.compartments.create({ luggageId, name: 'Neceser' })
    })
    const more = screen.getByRole('button', {
      name: 'Más acciones de Neceser',
    })
    expect(
      screen.queryByRole('button', { name: 'Renombrar' }),
    ).not.toBeInTheDocument()

    await user.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('button', { name: 'Renombrar Neceser' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Quitar Neceser de la maleta' }),
    ).toBeVisible()

    await user.click(more)
    expect(
      screen.queryByRole('button', { name: 'Renombrar' }),
    ).not.toBeInTheDocument()
  })

  it('se puede renombrar sin desplegar el compartimento', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await repos.compartments.create({ luggageId, name: 'Neceser' })
    })
    await user.click(screen.getByRole('button', { name: /^Neceser,/ }))

    await user.click(
      screen.getByRole('button', { name: 'Más acciones de Neceser' }),
    )
    await user.click(screen.getByRole('button', { name: 'Renombrar Neceser' }))
    await user.keyboard('Aseo{Enter}')

    expect(
      await screen.findByRole('button', { name: 'Aseo, Vacío' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('"Renombrar" → escribir → OK cambia el nombre', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await repos.compartments.create({ luggageId, name: 'Neceser' })
    })

    await user.click(
      screen.getByRole('button', { name: 'Más acciones de Neceser' }),
    )
    await user.click(screen.getByRole('button', { name: 'Renombrar Neceser' }))
    const input = screen.getByRole('textbox', {
      name: 'Nombre del compartimento',
    })
    expect(input).toHaveValue('Neceser')
    await user.keyboard('Aseo{Enter}')

    expect(
      await screen.findByRole('button', { name: 'Aseo, Vacío' }),
    ).toBeInTheDocument()
  })

  it('al borrarlo, avisa y sus artículos pasan a sueltos (SET NULL)', async () => {
    const { user, repositories, luggage } = await openLuggage(
      async (repos, luggageId) => {
        const kit = await repos.compartments.create({
          luggageId,
          name: 'Neceser',
        })
        await addItem(repos, luggageId, 'Cepillo', { compartmentId: kit.id })
        await addItem(repos, luggageId, 'Pasta', { compartmentId: kit.id })
      },
    )

    await user.click(
      screen.getByRole('button', { name: 'Más acciones de Neceser' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Quitar Neceser de la maleta' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: '¿Quitar «Neceser» de la maleta?',
    })
    expect(dialog).toHaveTextContent(
      'Sus 2 artículos quedarán sueltos en la maleta.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /^Neceser,/ }),
      ).not.toBeInTheDocument(),
    )
    // Los artículos siguen en la maleta, ahora sueltos.
    expect(
      screen.getByRole('checkbox', { name: 'Cepillo' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Pasta' })).toBeInTheDocument()
    const entries = await repositories.quantities.listByLuggage(luggage.id)
    expect(entries.every((e) => e.compartmentId === null)).toBe(true)
  })
})

describe('Mover a… (fila desplegada)', () => {
  it('sin compartimentos no aparece el selector', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await addItem(repos, luggageId, 'Cepillo')
    })

    await user.click(screen.getByRole('button', { name: /^Cepillo,/ }))

    expect(
      screen.queryByRole('combobox', { name: 'Mover a' }),
    ).not.toBeInTheDocument()
  })

  it('mueve un artículo suelto a un compartimento y lo devuelve a sueltos', async () => {
    const { user, repositories, luggage } = await openLuggage(
      async (repos, luggageId) => {
        await repos.compartments.create({ luggageId, name: 'Neceser' })
        await addItem(repos, luggageId, 'Cepillo')
      },
    )
    await user.click(screen.getByRole('button', { name: /^Cepillo,/ }))
    const select = screen.getByRole('combobox', { name: 'Mover a' })
    expect(select).toHaveDisplayValue('Suelto en la maleta')

    await user.selectOptions(select, 'Neceser')

    expect(
      await within(screen.getByRole('region', { name: 'Neceser' })).findByRole(
        'checkbox',
        { name: 'Cepillo' },
      ),
    ).toBeInTheDocument()
    const [kit] = await repositories.compartments.listByLuggage(luggage.id)
    expect(
      (await repositories.quantities.listByLuggage(luggage.id))[0],
    ).toMatchObject({ compartmentId: kit.id })

    // La fila sigue desplegada en su nuevo sitio: se puede devolver.
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Mover a' }),
      'Suelto en la maleta',
    )
    // Primero esperamos a lo que VE el usuario (la UI se refresca un
    // instante después de guardar) y después comprobamos los datos.
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Neceser' })).queryByRole(
          'checkbox',
          { name: 'Cepillo' },
        ),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.getByRole('checkbox', { name: 'Cepillo' }),
    ).toBeInTheDocument()
    expect(
      (await repositories.quantities.listByLuggage(luggage.id))[0],
    ).toMatchObject({ compartmentId: null })
  })
})

describe('Compartimento "listo" (estado propio)', () => {
  it('el círculo lo marca como listo, se pliega solo y cuenta como un bloque', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Cepillo', {
        compartmentId: kit.id,
        packed: true,
      })
      await addItem(repos, luggageId, 'Pasaporte')
    })
    // Bloques: Pasaporte (suelto, sin guardar) + Neceser (sin marcar).
    expect(screen.getByText('0 de 2 listos')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Neceser listo' }))

    // waitFor y no findByRole: el checkbox YA existía (sin marcar), así que
    // findByRole lo devolvía al instante y a veces se comprobaba antes de
    // que cambiara (test intermitente). Hay que esperar al CAMBIO.
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Neceser listo' }),
      ).toBeChecked(),
    )
    // Se pliega solo: sus artículos dejan de verse.
    expect(
      screen.getByRole('button', { name: 'Neceser, Listo' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('checkbox', { name: 'Cepillo' }),
    ).not.toBeInTheDocument()
    // Y el progreso de la maleta lo cuenta como un bloque hecho.
    expect(screen.getByText('1 de 2 listos')).toBeInTheDocument()
  })

  it('se puede marcar con artículos sin guardar: sigue viéndose su progreso, sin mensaje', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Cepillo', { compartmentId: kit.id })
      await addItem(repos, luggageId, 'Pasta', { compartmentId: kit.id })
    })

    await user.click(screen.getByRole('checkbox', { name: 'Neceser listo' }))

    // waitFor: el checkbox ya existía (sin marcar); hay que esperar a que
    // CAMBIE, no a que aparezca.
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Neceser listo' }),
      ).toBeChecked(),
    )
    // Decisión de producto: nada de "sin guardar", solo su progreso. Y como
    // le faltan artículos, NO se pliega: se queda a la vista.
    expect(
      screen.getByRole('button', { name: 'Neceser, 0 de 2' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByText(/sin guardar/)).not.toBeInTheDocument()
    // Cuenta como bloque hecho igualmente (decisión de producto).
    expect(screen.getByText('¡Maleta lista!')).toBeInTheDocument()
  })

  it('desmarcarlo no lo despliega ni toca sus artículos', async () => {
    const { user, repositories, luggage } = await openLuggage(
      async (repos, luggageId) => {
        const kit = await repos.compartments.create({
          luggageId,
          name: 'Neceser',
        })
        await addItem(repos, luggageId, 'Cepillo', {
          compartmentId: kit.id,
          packed: true,
        })
      },
    )
    const check = screen.getByRole('checkbox', { name: 'Neceser listo' })
    await user.click(check)
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Neceser listo' }),
      ).toBeChecked(),
    )

    await user.click(screen.getByRole('checkbox', { name: 'Neceser listo' }))

    expect(
      await screen.findByRole('button', { name: 'Neceser, 1 de 1' }),
    ).toHaveAttribute('aria-expanded', 'false')
    const [cepillo] = await repositories.quantities.listByLuggage(luggage.id)
    expect(cepillo.nAlreadyPacked).toBe(1)
  })
})

describe('Plegado automático', () => {
  it('se pliega solo cuando su último artículo queda listo', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Cepillo', {
        compartmentId: kit.id,
        packed: true,
      })
      await addItem(repos, luggageId, 'Pasta', { compartmentId: kit.id })
    })
    const toggle = () => screen.getByRole('button', { name: /^Neceser,/ })
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('checkbox', { name: 'Pasta' }))

    await waitFor(() =>
      expect(toggle()).toHaveAttribute('aria-expanded', 'false'),
    )
    // Si se despliega a mano, no se vuelve a plegar solo.
    await user.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('al abrir una maleta con un compartimento ya completo, no lo pliega', async () => {
    await openLuggage(async (repos, luggageId) => {
      const kit = await repos.compartments.create({
        luggageId,
        name: 'Neceser',
      })
      await addItem(repos, luggageId, 'Cepillo', {
        compartmentId: kit.id,
        packed: true,
      })
    })

    expect(screen.getByRole('button', { name: /^Neceser,/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})
