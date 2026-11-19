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
  it('sin compartimentos, explica qué son', async () => {
    await openLuggage()

    expect(
      screen.getByText(
        'Contenedor para meter artículos, como un neceser, una mochila o un maletín.',
      ),
    ).toBeInTheDocument()
  })

  it('"Nuevo compartimento" → escribir → OK lo crea; la ayuda desaparece', async () => {
    const { user, repositories, luggage } = await openLuggage()

    await user.click(
      screen.getByRole('button', { name: 'Nuevo compartimento' }),
    )
    await user.keyboard('Neceser{Enter}')

    expect(
      await screen.findByRole('button', { name: 'Neceser, Vacío' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        'Contenedor para meter artículos, como un neceser, una mochila o un maletín.',
      ),
    ).not.toBeInTheDocument()
    expect(
      await repositories.compartments.listByLuggage(luggage.id),
    ).toHaveLength(1)
  })

  it('Escape o un nombre vacío no crean nada', async () => {
    const { user, repositories, luggage } = await openLuggage()
    const newButton = () =>
      screen.getByRole('button', { name: 'Nuevo compartimento' })

    await user.click(newButton())
    await user.keyboard('Neceser{Escape}')
    await user.click(newButton())
    await user.keyboard('   {Enter}')

    expect(await repositories.compartments.listByLuggage(luggage.id)).toEqual(
      [],
    )
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
    expect(names).toEqual(['Pasaporte', 'Cepillo', 'Pasta'])

    expect(
      screen.getByRole('button', { name: 'Neceser, 1 de 2' }),
    ).toBeInTheDocument()
  })

  it('un compartimento completo dice "Listo"', async () => {
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
      screen.getByRole('button', { name: 'Neceser, Listo' }),
    ).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Renombrar' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Borrar compartimento' }),
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
    await user.click(screen.getByRole('button', { name: 'Renombrar' }))
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
    await user.click(screen.getByRole('button', { name: 'Renombrar' }))
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
      screen.getByRole('button', { name: 'Borrar compartimento' }),
    )
    const dialog = screen.getByRole('dialog', { name: '¿Borrar «Neceser»?' })
    expect(dialog).toHaveTextContent(
      'Sus 2 artículos quedarán sueltos en la maleta.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }))

    expect(
      await screen.findByText(
        'Contenedor para meter artículos, como un neceser, una mochila o un maletín.',
      ),
    ).toBeInTheDocument()
    // Los artículos siguen en la maleta, ahora sueltos.
    expect(
      screen.getByRole('checkbox', { name: 'Cepillo' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Pasta' })).toBeInTheDocument()
    const entries = await repositories.quantities.listByLuggage(luggage.id)
    expect(entries.every((e) => e.compartmentId === null)).toBe(true)
  })
})

describe('Añadir dentro de un compartimento ("+")', () => {
  /** <section aria-label="Neceser"> tiene el rol accesible "region". */
  const region = (name: string) => screen.getByRole('region', { name })

  it('"+" abre un campo dentro, ya enfocado; lo añadido entra en el compartimento', async () => {
    const { user, repositories, luggage } = await openLuggage(
      async (repos, luggageId) => {
        await repos.compartments.create({ luggageId, name: 'Neceser' })
      },
    )

    await user.click(screen.getByRole('button', { name: 'Añadir a Neceser' }))
    const input = within(region('Neceser')).getByRole('textbox', {
      name: 'Añadir a Neceser',
    })
    expect(input).toHaveFocus()
    await user.keyboard('Cepillo{Enter}')

    expect(
      await within(region('Neceser')).findByRole('checkbox', {
        name: 'Cepillo',
      }),
    ).toBeInTheDocument()
    // El campo sigue abierto y enfocado para añadir el siguiente.
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    const [kit] = await repositories.compartments.listByLuggage(luggage.id)
    const [added] = await repositories.quantities.listByLuggage(luggage.id)
    expect(added.compartmentId).toBe(kit.id)
  })

  it('"+" en un compartimento plegado lo despliega', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await repos.compartments.create({ luggageId, name: 'Neceser' })
    })
    await user.click(screen.getByRole('button', { name: /^Neceser,/ }))
    expect(screen.getByRole('button', { name: /^Neceser,/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    await user.click(screen.getByRole('button', { name: 'Añadir a Neceser' }))

    expect(screen.getByRole('button', { name: /^Neceser,/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(
      screen.getByRole('textbox', { name: 'Añadir a Neceser' }),
    ).toHaveFocus()
  })

  it('al abrirse, el mismo botón pasa a "Dejar de añadir…" y lo cierra', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await repos.compartments.create({ luggageId, name: 'Neceser' })
    })

    await user.click(screen.getByRole('button', { name: 'Añadir a Neceser' }))
    const closeButton = screen.getByRole('button', {
      name: 'Dejar de añadir a Neceser',
    })
    expect(closeButton).toHaveAttribute('aria-expanded', 'true')

    await user.click(closeButton)

    expect(
      screen.queryByRole('textbox', { name: 'Añadir a Neceser' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Añadir a Neceser' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('Escape cierra el campo del compartimento', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await repos.compartments.create({ luggageId, name: 'Neceser' })
    })

    await user.click(screen.getByRole('button', { name: 'Añadir a Neceser' }))
    await user.keyboard('{Escape}')

    expect(
      screen.queryByRole('textbox', { name: 'Añadir a Neceser' }),
    ).not.toBeInTheDocument()
  })

  it('si el artículo ya está en la maleta (aunque sea suelto), avisa', async () => {
    const { user } = await openLuggage(async (repos, luggageId) => {
      await repos.compartments.create({ luggageId, name: 'Neceser' })
      await addItem(repos, luggageId, 'Cepillo')
    })

    await user.click(screen.getByRole('button', { name: 'Añadir a Neceser' }))
    await user.keyboard('cepillo{Enter}')

    expect(
      await within(region('Neceser')).findByText(
        '«cepillo» ya está en la maleta.',
      ),
    ).toBeInTheDocument()
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
