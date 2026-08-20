# Design: Areas controllers

Five endpoints for the `areas` domain, mirroring the vertical already
established by `accounts`: Prisma repositories in `libs/database`, a domain
service in a new `libs/areas`, and the HTTP port in `src/controllers/areas`.

All five routes are restricted to `ADMIN` and `MASTER`.

| Method | Route | Shape |
| --- | --- | --- |
| GET | `areas/list` | paginated, `_count` of logins and tickets |
| GET | `areas/:id/accounts` | full list, cached |
| GET | `areas/:id/tickets` | paginated, with requester/responser usernames |
| POST | `areas/create` | creates area + login links |
| PUT | `areas/:id` | updates alias, description, login links |

## Business rules

- **No `USER` is ever linked to an area.** Every `login_id` sent to
  `create` or `update` must exist and have role `ADMIN` or `MASTER`.
  Anything else is `422 invalid_area_logins`.
- An area always has at least one linked login. `create` requires a
  non-empty `logins` array; `update` rejects an empty one.
- Ticket-to-area assignment is **not** part of this domain. `tickets.area_id`
  is an attribute of the ticket and changes in the ticket workflow, next to
  `state`, `priority`, and `responser_login_id`. Putting a bulk reassignment
  here would duplicate a rule the tickets domain needs anyway.

## Layers

### `libs/database/src/repositories/areas`

`AreasRepository`, following `LoginsRepository` conventions: methods return
`T | void`, Prisma errors go through `this.repository.errorHandler(err)`.

- `findManyWithPagination<Args>({ where, offset, per_page, sort })` —
  `offsetPaginator` with `entity: 'areas'`,
  `bottom: PAGINATION_OPTIONS.aroundRange`, and
  `include: { _count: { select: { logins: true, tickets: true } } }`.
  Wrapped in `try/catch` returning `emptyPaginationData()` on an empty page,
  like `TicketsRepository`.
- `findAccountsById({ id, sort })` — `areas.findUnique` selecting
  `logins: { select: { logins: { select: { id, username, email } } },
  orderBy: { logins: { [column]: direction } } }`. Ordering by the related
  `logins` row is valid Prisma on a to-one relation from the join model.
- `createOne({ alias, description, created_at, login_ids })` —
  `areas.create` with a nested
  `logins: { create: login_ids.map((login_id) => ({ login_id })) }`
  (unchecked nested create; `area_id` is inferred), `select: { id: true }`.
- `updateOneById({ id, alias, description, login_ids })` — a
  `$transaction` that, **in this order**:
  1. `areas.update` with only the provided scalar fields and
     `select: { id: true }` — this throws `P2025` when the area does not
     exist, before any link is touched;
  2. when `login_ids` is provided, `logins_assigned_areas.deleteMany({
     where: { area_id: id } })` then `createMany` with the new pairs.

  Order matters: doing the delete first would let a missing area fall
  through to a foreign-key error instead of a clean not-found.

### `libs/database/src/repositories/tickets` (change)

`ITicketsFindManyWithPaginationParams` gains an optional `select`, passed
straight through to `offsetPaginator`. The paginator already forwards both
`select` and `include` to `findMany`, so `areas/:id/tickets` gets the
requester/responser usernames in the same query — no hydration pass, no N+1.
Existing callers pass nothing and are unaffected.

### `libs/database/src/repositories/logins` (change)

`findManyRolesByIds(ids: string[])` — `logins.findMany({ where: { id: { in:
ids } }, select: { id: true, role: true } })`. Used only to enforce the
ADMIN/MASTER rule.

### `libs/areas` (new lib, alias `@app/areas`)

`AreasService`, the domain layer. Registered in `nest-cli.json` projects,
`tsconfig.json` paths, the jest `moduleNameMapper` in `package.json`, and
`AppModule` imports, exactly like `libs/account`. Needs its own
`tsconfig.lib.json` copied from a sibling lib.

Methods:

- `findManyWithPagination(query)` — `parseSort`, delegate, throw
  `UnprocessableEntityException('repository_error')` on a falsy result.
- `findAccountsByAreaId({ area_id, sort })` — cache first, repository on
  miss, flatten `logins` to `{ id, username, email }[]`, cache with
  `CACHE_TTL.ten`. A missing area or an area with no members yields `[]`,
  not an error.
- `findTicketsByAreaId({ area_id, per_page, offset, sort })` — tickets
  repository with `where: { area_id }` and the select described below.
- `createOne({ alias, description, logins })` — validate the logins,
  create, invalidate cache, return `{ id }`.
- `updateOneById({ id, alias, description, logins })` — validate the logins
  when present, update, `NotFoundException('area_not_found')` on a void
  result, invalidate cache, return `{ id }`.
- private `validateAssignableLogins(ids)` — dedupe, fetch roles, and throw
  `UnprocessableEntityException('invalid_area_logins')` when any id is
  missing from the result or holds a role other than `ADMIN`/`MASTER`.
- private `invalidateCache()` — see below.

The tickets select:

```ts
{
  id: true,
  subject: true,
  priority: true,
  state: true,
  created_at: true,
  updated_at: true,
  login_requester: { select: { username: true } },
  login_responser: { select: { username: true } },
}
```

`login_responser` is nullable in the schema, so the item type is
`{ username: string } | null`.

### `src/controllers/areas`

The `app.controller.ts` stub (`getHello`) is replaced by:

- `areas.controller.ts` — `AreasController`, `@ApiTags('Areas')`,
  `@Controller('areas')`, one handler per route with
  `@Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)`, `@ApiBearerAuth('bearer')`
  and `@ApiResponse` entries for 200/201, 400, 401, 403, and 404 where it
  applies.
- `areas.service.ts` — `AreasControllerService`: delegation plus a `Logger`
  line on each write, in the format used by `AccountControllerService`.
- `areas.dto.ts` and `areas.interface.ts`.

`AppModule` swaps the stub import for the new controller and provider.

## DTOs

The global pipe runs with `transform`, `whitelist`, and
`forbidNonWhitelisted`, so every accepted field must be declared.

- `IAreaIdParamDTO` — `id` with a bare `@IsUUID()`. No version argument: ids
  are `uuid(7)` and `@IsUUID('4')` would reject all of them.
- `IAreasListQueryDTO` — `offset?`, `per_page`
  (`@IsIn(PAGINATION_OPTIONS.perPage)`), `sort`
  `@IsIn(['alias', '-alias', 'created_at', '-created_at'])`.
- `IAreaAccountsListQueryDTO` — `sort`
  `@IsIn(['username', '-username', 'email', '-email'])`. No pagination fields.
- `IAreaTicketsListQueryDTO` — `offset?`, `per_page`, `sort` over
  `created_at`, `updated_at`, `priority`, `subject`, each with its `-` form.
- `IAreaCreateDTO` — `alias` (`@IsString`, `@IsNotEmpty`, `@MaxLength(100)`),
  `description` (same with `@MaxLength(200)`), `logins` (`@IsArray`,
  `@ArrayNotEmpty`, `@IsUUID(undefined, { each: true })`).
- `IAreaUpdateDTO` — the same three fields, all `@IsOptional`, `logins` still
  `@ArrayNotEmpty` when present.

A body of `{}` on update passes class-validator, so
`AreasControllerService.update` rejects it with
`BadRequestException('empty_payload')` before reaching the domain.

## Cache

One namespace, `areas:*`:

- `areas:accounts:<area_id>:<sort>` — TTL `CACHE_TTL.ten`. The sort is part of
  the key because the ordering is done in the database.

Every write in this domain invalidates **two** collections:

```ts
await this.cache.deleteCollection('areas:*');
await this.cache.deleteCollection('account:areas:*');
```

The second one is the cross-domain part and is easy to miss:
`AccountService.findAssignedAreas` caches `account:areas:<login_id>` for ten
minutes, so changing an area's membership — or its alias — makes those
entries stale.

## Errors

| Status | When |
| --- | --- |
| 400 | DTO validation, or an empty update body |
| 401 | missing/invalid token |
| 403 | role is not ADMIN or MASTER |
| 404 | `areas/:id` update against an id that does not exist |
| 422 | `invalid_area_logins`, or `repository_error` on a falsy list result |

`errorHandler` already maps `P2002` to 409 and swallows `P2025` (which is what
turns a missing area into a void return, and then into the 404).

## Testing

TDD, jest, one spec per file, matching the existing style: `describe` naming
the class with a nested `describe` per method, `jest.mock('prisma-offset-paginator')`
in repository specs, plain mocks for cache and repositories in the domain
spec, delegation-plus-error-propagation in the controller specs.

Baseline before any change is red and stays that way: **7 suites / 31 tests
failing out of 99**, all stale specs from earlier renames (`LoginRepository`,
`AuthenticationControllerService`, `AccountController.update`,
`DatabaseService`, `AuthStrategyJwt`, `AccountService`). They are out of
scope; the same counts must hold at the end, plus the new passing specs.

## Non-goals

- No uniqueness check on `areas.alias` — the schema does not declare one.
- No area deletion.
- No changes to the stale specs listed above.
- No `prisma generate`, no `npm install`, no dependency additions.
- No ticket reassignment from this domain.
