# ADR 0003: Deleting a vehicle is a soft delete

- Status: accepted
- Date: 2026-10-25

## Context

`DELETE /api/vehicles/:id` is admin-only. A vehicle may already have been bought, and `Order` and
`InventoryEvent` rows point at it. A hard `DELETE` would either fail on the foreign keys or, with
`ON DELETE CASCADE`, erase customers' order history and the audit ledger.

## Decision

`Vehicle.deletedAt` (nullable timestamp). Deleting sets it; nothing is removed.

- Every read and write path that should not see a deleted car filters `deletedAt: null` inside the
  repository (`repositories/prisma-vehicle.repository.ts`, `prisma-inventory.repository.ts`). Services
  and controllers never see a deleted vehicle. List, search and get answer as if it never existed
  (`404 VEHICLE_NOT_FOUND`); update, restock and purchase do the same.
- The `where` of the delete itself includes `deletedAt: null`, so deleting twice is a 404 and writes
  one `DELETED` event, not two.
- Orders keep their own copy of what was bought: `unitPrice`, `totalPrice` and `vehicleLabel`
  ("Make Model") are stored on `Order`, so My orders still reads correctly after the car is edited or
  deleted. The inventory ledger keeps a `DELETED` event with the acting admin.

Tests: `test/integration/vehicles.delete.test.ts` ("soft-deletes ... keeps the row", "hides the vehicle
from the list, search and get, and blocks every action on it", "keeps existing orders, with their price
and name snapshots", "answers 404 when deleting it a second time, and writes only one event").

## Consequences

- Safe and auditable. The cost is that every new query on `Vehicle` must remember the filter. It is
  confined to the repository layer to keep that to one place, but it is a convention, not something the
  database enforces. (A partial index or a view would enforce it; not done.)
- There is no "restore" endpoint and no purge. A deleted row stays until someone runs SQL by hand.
- Deleted vehicles keep taking up space and still appear in the `InventoryEvent` rows that reference
  them.
- Nothing is unique on `Vehicle` (there is no VIN field), so re-adding "the same" car creates a new row
  and does not collide with a deleted one.
