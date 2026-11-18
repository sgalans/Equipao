Trip(id: uuid, name, startDate, endDate...)
    createdAt, updatedAt

Item(id: uuid, name, color...)
    createdAt, updatedAt

Luggage(id: uuid, tripId, name...)
    {tripId} references Trip on delete cascade
    createdAt, updatedAt

ItemQuantity(id: uuid, luggageId, itemId, num, nAlreadyPacked)
    {luggageId} references Luggage on delete cascade
    {itemId} references Item on delete restrict
    unique (luggageId, itemId)
    check num >= 0
    check nAlreadyPacked >= 0
    check nAlreadyPacked <= num
    createdAt, updatedAt