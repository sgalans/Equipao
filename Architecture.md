Luggage(id: uuid, name)
    createdAt, updatedAt

Compartment(id: uuid, luggageId, name)          -- pendiente: iteración 5
    {luggageId} references Luggage on delete cascade
    createdAt, updatedAt

Item(id: uuid, name)
    createdAt, updatedAt

ItemQuantity(id: uuid, luggageId, compartmentId?, itemId, num, nAlreadyPacked)
    {luggageId} references Luggage on delete cascade
    {compartmentId} references Compartment       -- opcional: null = ítem suelto en la maleta (iteración 5)
    {itemId} references Item on delete restrict
    unique (luggageId, itemId)                   -- un ítem ocupa un solo sitio por maleta
    invariant compartment.luggageId = luggageId  -- lo garantiza el repositorio
    check num >= 0
    check nAlreadyPacked >= 0
    check nAlreadyPacked <= num
    createdAt, updatedAt

-- Historial: hasta la iteración 2 existía Trip (Luggage.tripId → Trip). Se
-- eliminó porque añadía un nivel de navegación sin aportar al caso de uso
-- principal (preparar maletas); la reutilización se cubre duplicando maletas.
