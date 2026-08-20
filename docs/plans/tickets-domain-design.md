# Tickets Domain — Design

**Status:** approved
**Date:** 2026-08-20
**Scope:** new `@app/tickets` library, new `tickets` HTTP controller, and the
repository methods both require.

## 1. Goal

Expose the ticket aggregate over HTTP: a paginated list with the message count,
a cached full detail, a cached message thread, creation by any authenticated
account, and an ADMIN/MASTER-only update. Every write to a ticket drops the
cache belonging to that ticket.

## 2. Routes

Declaration order inside the controller matters: NestJS matches in declaration
order, so `@Get('list')` MUST be declared before `@Get(':id')`, otherwise
`/tickets/list` is captured by the param route.

| Method | Path | Roles | Paginated | Cached |
|---|---|---|---|---|
| GET | `tickets/list` | any authenticated | yes | no |
| GET | `tickets/:id` | any authenticated | no | yes |
| GET | `tickets/:id/messages` | any authenticated | no | yes |
| POST | `tickets/create` | any authenticated | — | — |
| PUT | `tickets/:id` | ADMIN, MASTER | — | — |

"any authenticated" means the handler carries no `@Roles()` decorator.
`RoleGuard` returns `true` when the `roles` metadata is absent, so
`JwtAuthGuard` alone gates the route. Visibility is then narrowed by the
scope rules in section 3 — never by the guard.

## 3. Visibility scope

This is the core rule of the domain. A private resolver on `TicketsService`
turns the authenticated account into a `where` fragment:

| Role | Fixed fragment | Query filters honored |
|---|---|---|
| `USER` | `{ requester_login_id: <account.id> }` | ignored |
| `ADMIN` / `MASTER` | none | `requester_login_id`, `responser_login_id` |

A `USER` is scoped by `requester_login_id` alone, not by
`requester_login_id OR responser_login_id`. Section 6 requires every
`responser_login_id` to be an ADMIN or MASTER, so a `USER` can never occupy
that column — the `OR` branch would be dead code, and the single-column form
uses the existing `@@index([requester_login_id])`.

`requester_login_id` and `responser_login_id` arriving as query filters from a
`USER` are dropped, not rejected: the fixed fragment already answers the
question, and a 400 would leak that the filter exists.

### 3.1 Scope on the single-row routes

`GET tickets/:id` does NOT push the scope fragment into the `where`. The row
is fetched unscoped, cached, and then authorized in memory against the cached
`requester_login_id`.

The reason is the cache. A scoped query would make the cached entry
role-dependent, forcing either a cache key per account or a cache that can
serve a row the caller may not see. Fetching one row unscoped and authorizing
after keeps a single entry per ticket and makes the cache-hit path and the
cache-miss path apply the identical check.

The outcome is the same either way: a `USER` asking for someone else's ticket
gets **404 `ticket_not_found`**, not 403. The row is simply not in their
scope, and 404 does not disclose that the ticket exists.

`GET tickets/:id/messages` inherits this: it resolves the ticket through the
same authorized path first, and only then reads the message thread. Messages
are never authorized against themselves.

`GET tickets/list` DOES push the fragment into the `where`, because pagination
counts must reflect the caller's scope.

## 4. Files

### 4.1 Modified

`backend/libs/database/src/repositories/tickets/repository.interface.ts`
- Add `TICKET_PRIORITIES` and `TICKET_STATES` const objects, next to the
  existing `TICKET_RELATIONS`. Hand-written, mirroring `LOGIN_ROLES` — this is
  the established pattern for feeding `@IsIn(Object.keys(...))` in a DTO.
- Add params/promise interfaces for the three new methods.

`backend/libs/database/src/repositories/tickets/repository.service.ts`
- Add `findOne`, `createOne`, `updateOneById`.
- `findManyWithPagination` is NOT modified. It already forwards `select`, and
  `_count: { select: { messages: true } }` nests inside that `select`.

`backend/libs/database/src/repositories/ticket-messages/repository.interface.ts`
`backend/libs/database/src/repositories/ticket-messages/repository.service.ts`
- Add `findManyByTicketId` — no pagination, ordered `created_at desc`.

`backend/libs/database/src/repositories/areas/repository.interface.ts`
`backend/libs/database/src/repositories/areas/repository.service.ts`
- Add `findOneById` returning `{ id }`, used to validate `area_id` before a
  write.

`backend/libs/database/src/index.ts` — export nothing new (the touched files
are already re-exported wholesale).

`backend/src/app.module.ts` — register `TicketsModule`, `TicketsController`,
`TicketsControllerService`.

`backend/tsconfig.json`, `backend/package.json` (jest `moduleNameMapper`),
`backend/nest-cli.json` — register the `@app/tickets` path alias, exactly the
four-place registration `@app/areas` already has (the fourth is the new lib's
own `tsconfig.lib.json`).

### 4.2 Created

```
backend/libs/tickets/src/tickets.interface.ts
backend/libs/tickets/src/tickets.service.ts
backend/libs/tickets/src/tickets.module.ts
backend/libs/tickets/src/index.ts
backend/libs/tickets/tsconfig.lib.json
backend/src/controllers/tickets/tickets.dto.ts
backend/src/controllers/tickets/tickets.interface.ts
backend/src/controllers/tickets/tickets.service.ts
backend/src/controllers/tickets/tickets.controller.ts
```

Layering follows `areas` exactly: Prisma repository (adapter) → domain service
(`libs/tickets`) → controller service (`src/controllers/tickets`) → controller.
The controller service owns request-shaped concerns (empty-payload rejection,
audit logging); the domain service owns business rules, cache, and validation.

## 5. Cache

| Key | Item | Payload | TTL |
|---|---|---|---|
| `tickets:detail` | `<ticket_id>` | full ticket + `_count.messages` | `CACHE_TTL.ten` |
| `tickets:messages` | `<ticket_id>` | full message thread, `created_at` desc | `CACHE_TTL.ten` |

`CacheModuleServices` joins key and item with `:`, so the effective Redis keys
are `tickets:detail:<id>` and `tickets:messages:<id>`.

Neither entry is per-account. The payload is identical for every caller who is
allowed to see it, and section 3.1 authorizes from the cached payload.

### 5.1 Invalidation

`PUT tickets/:id` drops exactly two keys, by name:

```ts
await this.cache.delete([
  `tickets:detail:${ticket_id}`,
  `tickets:messages:${ticket_id}`,
]);
```

Explicit `delete`, not `deleteCollection`. `deleteCollection` runs `SCAN` over
the whole keyspace; both keys are known exactly, so scanning buys nothing.

`POST tickets/create` invalidates nothing. The id is a fresh UUID v7, so no
cache entry for it can exist.

`tickets/list` is not cached — it is paginated and filterable, so the key space
would be unbounded and the hit rate near zero.

Cross-domain invalidation runs in one direction only.

**Tickets → areas: nothing to do.** `areas:accounts` holds logins per area and
`account:areas` holds areas per login; neither contains ticket data, so no
ticket write can stale them. `areas/:id/tickets` is uncached.

**Areas → tickets: required.** The ticket detail embeds `area.alias`, so
renaming an area stales every cached detail that points at it.
`AreasService.invalidateCache` therefore also drops `tickets:detail:*`. A
pattern delete is correct here, unlike the exact-key delete a ticket write
uses: an area write has no way to enumerate the tickets that reference it
without a query, so `SCAN` is the cheaper option.

`tickets:messages:*` is deliberately NOT dropped by an area write — the
message thread carries no area data.

The first version of this section claimed no cross-domain invalidation was
needed in either direction. That was wrong: the check considered which
tables each cache read from and missed the denormalized `alias` copied into
the detail payload. The final whole-branch review caught it.

## 6. Validation and errors

### 6.1 Why validation is explicit

`DatabaseService.errorHandler` returns `void` for every known Prisma error code
except `P2002`. A foreign-key violation (`P2003`) is therefore logged and
swallowed, and the repository method resolves to `void` — which the service
would report as `404 ticket_not_found`. That would be a misleading answer to
"this area_id does not exist". Every referenced id is therefore validated with
an explicit read before the write.

### 6.2 `POST tickets/create`

Body: `area_id` (optional uuid), `subject`, `description`.

`requester_login_id` comes from `@Account()` — the authenticated account —
and is never accepted from the body. `priority` and `state` are not accepted
either; they take the Prisma defaults (`NORMAL`, `NEW`). `created_at` is set by
the service, matching how `areas` and `account` create rows.

### 6.3 `PUT tickets/:id`

Body: `area_id`, `requester_login_id`, `responser_login_id`, `subject`,
`description`, `priority`, `state` — all optional. An entirely empty body is
rejected with **400 `empty_payload`**, in the controller service, mirroring
`AreasControllerService.updateOneById`.

| Condition | Status | Message |
|---|---|---|
| `responser_login_id` missing from `logins`, or its role is not ADMIN/MASTER | 422 | `invalid_ticket_responser` |
| `requester_login_id` missing from `logins` (any role accepted) | 422 | `invalid_ticket_requester` |
| `area_id` missing from `areas` | 422 | `invalid_ticket_area` |
| ticket does not exist | 404 | `ticket_not_found` |
| body has no updatable field | 400 | `empty_payload` |

The responser check reuses `LoginsRepository.findManyRolesByIds`, the same
method `AreasService.validateAssignableLogins` uses.

### 6.4 Read routes

| Condition | Status | Message |
|---|---|---|
| ticket does not exist, or is outside the caller's scope | 404 | `ticket_not_found` |
| repository returned `void` on a list | 422 | `repository_error` |

## 7. Query contract

### 7.1 `GET tickets/list`

| Param | Required | Shape |
|---|---|---|
| `per_page` | yes | one of `PAGINATION_OPTIONS.perPage` |
| `offset` | no | int ≥ 0 |
| `sort` | yes | one of `created_at`, `updated_at`, `priority`, `state`, `subject`, each also with a `-` prefix for descending |
| `state` | no | array of `TICKET_STATES` keys |
| `priority` | no | array of `TICKET_PRIORITIES` keys |
| `area_id` | no | uuid |
| `requester_login_id` | no | uuid — honored for ADMIN/MASTER only |
| `responser_login_id` | no | uuid — honored for ADMIN/MASTER only |

Array params use the same `@Transform` normalization as
`IAccountsListQueryDTO.role`, so a single value and a repeated value both
arrive as an array.

Row shape: `id`, `subject`, `priority`, `state`, `created_at`, `updated_at`,
`area { id, alias }`, `login_requester { username }`,
`login_responser { username }`, `_count { messages }`.

### 7.2 `GET tickets/:id`

No query params. Returns `id`, `area_id`, `requester_login_id`,
`responser_login_id`, `subject`, `description`, `priority`, `state`,
`created_at`, `updated_at`, `area { id, alias }`,
`login_requester { id, username }`, `login_responser { id, username }`,
`_count { messages }`.

The two raw `*_login_id` columns are part of the payload on purpose — section
3.1 authorizes from them.

### 7.3 `GET tickets/:id/messages`

No query params, no pagination. Ordered `created_at` **descending** — newest
message first. The order is fixed, not client-selectable, which keeps the
cache at one entry per ticket. `@@index([ticket_id, created_at])` serves it.

Row shape: `id`, `message`, `created_at`, `login { id, username }`.

## 8. Testing

Only the new domain is covered. The branch inherits six failing suites from
`main` (`libs/account/src/account.service.spec.ts`,
`libs/auth/src/strategies/jwt.strategy.spec.ts`,
`libs/auth/src/strategies/local.strategy.spec.ts`,
`libs/database/src/database.service.spec.ts`,
`src/controllers/account/account.controller.spec.ts`,
`src/controllers/account/account.service.spec.ts`) — 25 failing of 159 tests —
plus 18 pre-existing `tsc` errors. These are out of scope and must not be
touched; the branch is judged on not making them worse.

New specs:

- `libs/database/src/repositories/tickets/repository.spec.ts`
- `libs/database/src/repositories/ticket-messages/repository.spec.ts`
- `libs/tickets/src/tickets.service.spec.ts` — the scope resolver carries the
  heaviest coverage: a USER reading their own ticket, a USER blocked from
  another's (404, from cache and from the repository alike), an ADMIN reading
  unscoped, a USER's list query filters being dropped, an ADMIN's being
  applied.
- `src/controllers/tickets/tickets.service.spec.ts`
- `src/controllers/tickets/tickets.controller.spec.ts`
- `src/controllers/tickets/tickets.dto.spec.ts`

## 9. Global constraints

- **No co-authorship or AI attribution in commit messages.** No
  `Co-Authored-By`, no generated-with line, no trailer of any kind.
- **No lint or format commands.** The IDE formats on save. Verify with `jest`
  and `tsc` only.
- **No `git push`, no `git pull`, no remote operation.** The branch merges to
  local `main` at the end and stops there.
- **UUID v7 everywhere.** Every DTO `example` and every test fixture id uses
  the `019538c4-2f7a-7c31-9c1b-<12 digits>` pattern. A zero-filled placeholder
  fails `@IsUUID()`.
- **No `prisma generate`, no `npm install`, no dependency additions.**
- **No schema changes and no migrations.** The indexes this design relies on
  already exist in `schema.prisma`.

## 10. Non-goals

- **Unassigning an area or a responser.** `PUT` accepts uuids only; a field
  that is absent means "leave it alone", and there is no way to send `null`.
  Adding it later means a nullable DTO field plus a `ValidateIf`.
- **Creating, editing, or deleting messages.** `tickets/:id/messages` is
  read-only. Because nothing else writes messages, the messages cache can only
  be staled by a ticket write, which is why it carries a 10-minute TTL rather
  than relying on invalidation alone.
- **Deleting tickets.**
- **Restricting `subject`/`description` beyond the column limits.**
- **Repairing the six inherited failing suites or the 18 `tsc` errors.**
