# Elham — Appointment Booking API

NestJS + TypeScript + PostgreSQL + Prisma + Socket.IO, documented with OpenAPI (Swagger UI).

## Requirements

- Node.js 20+ (tested with 22)
- PostgreSQL 14+ (tested with 18)

## Setup

```bash
npm install
cp .env.example .env            # set DATABASE_URL to your database
npm run db:migrate              # prisma migrate deploy
npm run db:seed                 # inserts 6 fixed slots (idempotent)
npm run build && npm start      # or: npm run start:dev
```

### Environment variables

| Variable       | Example                                                      | Notes                  |
|----------------|--------------------------------------------------------------|------------------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/booking`       | required               |
| `PORT`         | `3000`                                                       | optional, default 3000 |

## API

| Method | Path                      | Description                     |
|--------|---------------------------|---------------------------------|
| GET    | `/slots`                  | Available slots, sorted by `startsAt`, then `id` |
| POST   | `/bookings`               | Book a slot                     |
| DELETE | `/bookings/{bookingId}`   | Cancel a booking (idempotent)   |

- Swagger UI: http://localhost:3000/docs
- OpenAPI spec: http://localhost:3000/openapi.json

Errors always look like `{"error":{"code":"SLOT_UNAVAILABLE","message":"..."}}` with codes
`VALIDATION_ERROR` (400), `SLOT_NOT_FOUND` / `BOOKING_NOT_FOUND` (404), `SLOT_UNAVAILABLE` (409), `INTERNAL_ERROR` (500).
Stack traces and database details are never returned.

Quick check with curl:

```bash
curl localhost:3000/slots
curl -X POST localhost:3000/bookings -H "Content-Type: application/json" \
  -d '{"slotId":"11111111-1111-4111-8111-111111111111","customerName":"Alex Morgan","customerEmail":"alex@example.com"}'
curl -X DELETE localhost:3000/bookings/<bookingId>
```

## Socket.IO

Same server, default namespace `/`, path `/socket.io`, no auth, no client events.
Events are emitted once, only after the database change is committed:

| Event           | Payload                                                   | When                                |
|-----------------|-----------------------------------------------------------|-------------------------------------|
| `slot.booked`   | `{"slotId":"…","bookingId":"…","available":false}`        | a booking is created (201)          |
| `slot.released` | `{"slotId":"…","bookingId":"…","available":true}`         | an active booking is cancelled      |

No event for rejected requests (400/404/409) or for repeated cancels. Payloads contain no customer data.

Test without a UI — in one terminal run the listener, then call the API from another:

```bash
npm run socket:listen                 # or: npm run socket:listen -- http://localhost:3000
```

## Tests

Tests are end-to-end: they boot the real Nest app and hit a real PostgreSQL database (no mocks).

```bash
cp .env.test.example .env.test         # point DATABASE_URL to a separate, empty test database
createdb booking_test                  # or create it with any tool
npm run test:db:setup                  # applies migrations to the test DB
npm test
```

Each test truncates `bookings` and re-seeds the fixed slots, so runs are repeatable and independent.

Covered:
1. Booking returns 201 and the slot disappears from `GET /slots`.
2. Two overlapping requests for the same slot (sent with `Promise.all`, different customers): one 201, one 409, and exactly one active booking in the database.
3. Cancel returns 200, the slot is available again, and a new booking succeeds.
4. Extra: idempotent cancel that does not touch a newer active booking, slot ordering, error codes, Socket.IO events.

## Preventing double booking

The database enforces the rule, not the application:

```sql
CREATE UNIQUE INDEX "bookings_one_active_per_slot" ON "bookings" ("slot_id") WHERE "status" = 'active';
```

`POST /bookings` checks the slot exists (404), then simply inserts an `active` booking. If two requests race,
PostgreSQL lets only one insert commit; the other fails with a unique violation (Prisma `P2002`), which is mapped to
`409 SLOT_UNAVAILABLE`. This is correct across any number of app instances and needs no locks or retries.

Cancelling uses a conditional update (`UPDATE … WHERE id = $1 AND status = 'active'`), so a repeated or concurrent
cancel changes nothing and emits no event, and an old cancelled booking can never affect a newer active one
(cancelled rows are kept, so a slot can have many cancelled bookings but at most one active).

## Main decisions

- `slots` and `bookings` tables; `status` is a Postgres enum (`active`, `cancelled`); `cancelled_at` kept for history.
- A `CHECK (ends_at > starts_at)` constraint on slots.
- Slots are seeded with fixed UUIDs; the seed uses upsert so it can be re-run.
- Validation is explicit (small functions) so every error maps exactly to the spec codes; name and email are trimmed
  before validation and storage. `customerName` max 200 chars, `customerEmail` max 254 chars.
- A global exception filter formats every error, including malformed JSON (400) and unexpected errors (500).
- Socket.IO events are emitted after the Prisma call resolves, i.e. after commit.

## Possible improvements

- Idempotency keys for `POST /bookings` so client retries don't create a second booking after a successful one.
- Rate limiting and request logging with correlation ids.
- Transactional outbox for events if delivery guarantees become a requirement.
- `GET /bookings/{id}` and pagination if the API grows.

## Time spent and known gaps

- Actual time: about 1.5 hours (implementation with an AI coding assistant, plus review and testing).
- Known gaps: none of the required features are missing. Socket.IO delivery is best effort, as allowed by the spec.

## AI disclosure

I used Claude Code (Anthropic) as a coding assistant to scaffold the project and write the implementation, tests and
this README. I reviewed the code, checked it against the spec, and verified it by running the end-to-end tests against
a real PostgreSQL database (including repeating the concurrency test several times) and by calling the API and
`/docs` manually. I understand the code and can explain and modify it.
