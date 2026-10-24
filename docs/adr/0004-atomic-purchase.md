# ADR 0004: Purchase is one guarded UPDATE inside a transaction

- Status: accepted
- Date: 2026-10-25

## Context

Two buyers can press Purchase on the last unit at the same moment. The obvious code reads the stock,
checks it, then writes the new value. Between the read and the write another request can do the same
and both succeed, leaving stock at -1 or one unit sold twice. The kata requires Purchase to be
unavailable at zero stock; the server has to guarantee it, not only the button.

## Decision

`PrismaInventoryRepository.purchase` runs in one database transaction:

1. `updateMany({ where: { id, deletedAt: null, quantity: { gte: n } }, data: { quantity: { decrement: n } } })`.
   This is a single SQL statement of the form `UPDATE ... SET quantity = quantity - n WHERE ... AND quantity >= n`.
   PostgreSQL takes a row lock; a competing buyer waits, then re-evaluates `quantity >= n` against the
   new value. There is no gap between checking and taking.
2. If `count === 0`, a follow-up read decides the error: missing or soft-deleted gives
   `404 VEHICLE_NOT_FOUND`, otherwise `409 OUT_OF_STOCK` with the real remaining stock.
3. In the same transaction: read the vehicle (our own update holds the row lock, so the price read is
   the price sold at), insert the `Order` with price and name snapshots, and insert a `PURCHASED`
   `InventoryEvent` with `delta = -n` and `quantityAfter`.
4. If any step throws, the transaction rolls back: no stock change without an order and an event.

A second line of defence is in the schema: `CHECK ("quantity" >= 0)` on `Vehicle` (init migration), so a
future bug cannot store a negative stock even if the guarded update is bypassed.

Restock uses the same idea in the other direction (`quantity: { increment: n }`), so two simultaneous
restocks add up instead of overwriting each other.

Evidence: `test/integration/vehicles.purchase.test.ts`, "under concurrent purchases". Ten signed-in
buyers fire at once at a vehicle with 3 units: exactly 3 get 200, 7 get 409 `OUT_OF_STOCK`, stock ends
at 0, and there are exactly 3 orders and 3 `PURCHASED` events whose `quantityAfter` values are 0, 1 and
2. A second test has six buyers each asking for 2 of 5 units: two succeed, four get 409, one unit is
left.

## Alternatives considered

- **`SELECT ... FOR UPDATE` then `UPDATE`.** Also correct and easier to read, but two round trips and a
  lock held for the whole read-then-write; the single statement does the same with less to get wrong.
- **Optimistic locking with a version column and retry.** Works, but needs retry code and fails
  confusingly under heavy contention, for no benefit at this scale.
- **Application-level mutex.** Wrong: it only works inside one process.

## Consequences

- Correct with several API instances, because the guard lives in the database.
- Under heavy contention for one vehicle, buyers queue on that row's lock. That is the intended
  behaviour for a limited stock.
- The tests run the race through supertest in one process with a shared connection pool. They show the
  SQL is safe against concurrent transactions; they were not run against several API processes or
  machines, though the guarantee comes from PostgreSQL, not from the process.
- The API takes `quantity` in the body (default 1, positive integer), so "buy 2" is also atomic.
