Luggage(id: uuid, name, description)              -- description: '' = sin descripción (máx. 500)
    createdAt, updatedAt

Item(id: uuid, name, isContainer)                  -- isContainer: Neceser, Mochila… (se marca; no cualquier artículo)
    invariant isContainer solo cambia si no está en ninguna maleta  -- ConsistencyError (opción A)
    unique (name)                                -- sin distinguir mayúsculas ni tildes (isSameItemName)
    createdAt, updatedAt

ItemQuantity(id: uuid, luggageId, compartmentId?, itemId, num, nAlreadyPacked, position)
    {luggageId} references Luggage on delete cascade
    {compartmentId} references ItemQuantity on delete set null  -- su COMPARTIMENTO (una línea contenedor); null = suelto
    {itemId} references Item on delete cascade   -- borrar del catálogo lo quita de las maletas (con aviso en la UI);
                                                 -- si es un contenedor, lo que llevaba dentro pasa a suelto
    unique (luggageId, itemId)                   -- un ítem ocupa un solo sitio por maleta (un Neceser por maleta)
    invariant compartment = línea de la MISMA maleta, cuyo item.isContainer, y de primer nivel (no se anidan)
    invariant si item.isContainer: compartmentId = null y num = 1
    check num >= 0
    check nAlreadyPacked >= 0
    nAlreadyPacked: con cuántas unidades se marcó como listo (0 = sin marcar)
    listo = (nAlreadyPacked = num)               -- derivado; cambiar num lo desmarca, volver a él lo marca
    check nAlreadyPacked <= num  solo al crear   -- después puede ser mayor (se bajó la cantidad)
    position: orden manual dentro de la maleta (fractional indexing: clave de
              texto, se ordena por unidades de código; nueva línea = al final;
              mover = una clave entre las de sus vecinos, cambia UNA fila)
    createdAt, updatedAt

-- Compartimento = LÍNEA CONTENEDOR (refactor/compartments, patrón Composite;
-- lista de adyacencia: compartmentId apunta a otra fila de la misma tabla).
-- Su nombre es el del contenedor del catálogo (compartido entre maletas) y
-- su "listo" es la línea guardada (1 de 1). Hasta la v6 era una tabla propia
-- Compartment(id, luggageId, name, isReady, position); la v6 la convirtió en
-- líneas (mismo id) y la v7 la eliminó.

-- Historial: hasta la iteración 2 existía Trip (Luggage.tripId → Trip). Se
-- eliminó porque añadía un nivel de navegación sin aportar al caso de uso
-- principal (preparar maletas); la reutilización se cubre duplicando maletas.
