# ADR 0001: Creating and updating vehicles is admin-only

- Status: accepted
- Date: 2026-10-24

## Context

The kata lists the vehicle endpoints under "Vehicles (Protected)". Only
`DELETE /api/vehicles/:id` and `POST /api/vehicles/:id/restock` are marked
"Admin only" in the endpoint list. `POST /api/vehicles` ("Add a new vehicle")
and `PUT /api/vehicles/:id` ("Update a vehicle's details") carry no role note,
so read alone they could be open to any signed-in user.

The frontend section of the same document says: "(For Admin Users) Forms/UI
to add, update, and delete vehicles." That line puts adding and updating in the
admin-only column with deleting.

## Decision

`POST /api/vehicles` and `PUT /api/vehicles/:id` require the `ADMIN` role, in
the same way as `DELETE` and `restock`. Everything that only reads, and
`POST /api/vehicles/:id/purchase`, needs any signed-in user.

All of these rules live in one place, `ACCESS_POLICY` in
`backend/src/policy/access-policy.ts`. Routes call `authorize('<METHOD> <path>')`;
no handler contains its own role check. Changing a rule means changing one line
there, and the role matrix test (`test/integration/role-matrix.test.ts`) states
the expected answer for every route independently of the map.

## Consequences

- A `USER` who calls `POST` or `PUT` on vehicles gets `403 FORBIDDEN`; an
  anonymous caller gets `401 UNAUTHENTICATED`.
- A customer can never change prices or listings. Letting every account edit
  prices would make the inventory untrustworthy.
- `PUT` cannot change `quantity`. Stock moves only through purchase and restock,
  so every change to it is recorded in the inventory ledger.
- If a reviewer reads the endpoint list literally (create/update open to every
  user), the fix is two lines in `ACCESS_POLICY` plus the matching rows in the
  role matrix test.
