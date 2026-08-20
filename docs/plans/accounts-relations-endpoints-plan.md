# Plan: Accounts relations endpoints

Three new GET endpoints on the existing `accounts` controller, exposing a
login's related tickets, ticket messages, and assigned areas.

- `GET accounts/tickets/:id?relation=requester|responser` — paginated
- `GET accounts/messages/:id` — paginated
- `GET accounts/areas/:id` — not paginated, cached

Architecture is hexagonal-ish and already established in the repo:
`libs/database` holds Prisma repositories (adapters), `libs/account` holds the
domain service, `src/controllers/account` holds the HTTP port (controller +
controller service + DTOs).

## Global Constraints

These bind every task. They come from the approved design.

- **No comments inside methods.** The existing code has none; do not add any.
  Decorator metadata and Swagger decorators are not comments.
- **Naming semantics must match the existing code exactly:**
  - Repository interfaces: `I<Model><Action><Params|Promise>`, e.g.
    `ITicketsFindManyWithPaginationParams`, `ILoginsFindAssignedAreasPromise`.
  - Domain interfaces in `libs/account`: `IAccount<Thing><Params|Promise>`.
  - Const-objects for fixed value sets follow `LOGIN_ROLES`:
    `export const X = { a: 'a' } as const;` and types via
    `keyof typeof X`.
  - Repository classes: `<Model>Repository` (`TicketsRepository`,
    `TicketMessagesRepository`).
  - Spec `describe` blocks name the class under test, with a nested
    `describe` per method — matching `repository.spec.ts` and
    `account.controller.spec.ts`.
- **Repository methods return `T | void`** and route Prisma errors through
  `this.repository.errorHandler(err)` in a `.catch()`, exactly like every
  method in `LoginsRepository`.
- **Pagination goes through `offsetPaginator`** with
  `bottom: PAGINATION_OPTIONS.aroundRange`, returning `TPaginationData`.
  Note `offsetPaginator` returns `undefined` when `data.length === 0`.
- **Sorting** uses `parseSort` from `utils/parse-sort` (returns
  `{ column, direction }`), and `sort` values are validated by `@IsIn` in
  the DTO with the `-` prefix meaning descending.
- **Tests are written before implementation** (TDD) and run with
  `npx jest` from the `backend/` directory.
- **Baseline is red:** 7 suites / 20 tests already fail on this branch
  (stale specs from the rename commit: `LoginRepository`, `IAuthCreateDTO`,
  `database.login`). Do not fix unrelated stale specs. Only specs for files
  you create or modify are yours. Report the suite counts before and after.
- **Do not run `prisma generate`, `npm install`, or any git push.**

## Task 1: Database layer

Create the two new repositories and the assigned-areas read, and wire them
into the module.

### 1a. `libs/database/src/repositories/tickets/repository.interface.ts`

```ts
export const TICKET_RELATIONS = {
  requester: 'requester',
  responser: 'responser',
} as const;

export interface ITicketsFindManyWithPaginationParams<Args> {
  where: Args;
  offset?: number;
  per_page: number;
  sort: {
    column: string;
    direction: 'asc' | 'desc';
  };
}
```

`TICKET_RELATIONS` lives here, not in `libs/account`, because it is a runtime
value and `account.dto.ts` must import it. It mirrors `LOGIN_ROLES`, which sits
in the logins repository interface and is already imported as a value by the
same DTO file. Putting it in `@app/account` would close a require cycle, since
`libs/account/account.service.ts` imports the controller DTO.

### 1b. `libs/database/src/repositories/tickets/repository.service.ts`

`TicketsRepository` with `findManyWithPagination<Args>(params)` returning
`Promise<TPaginationData | void>`. Same body shape as
`LoginsRepository.findManyWithPagination`, but `entity: 'tickets'` and no
`include`.

### 1c. `libs/database/src/repositories/ticket-messages/repository.interface.ts`

`ITicketMessagesFindManyWithPaginationParams<Args>` — same shape as 1a.

### 1d. `libs/database/src/repositories/ticket-messages/repository.service.ts`

`TicketMessagesRepository.findManyWithPagination<Args>` with
`entity: 'ticket_messages'`.

### 1e. `LoginsRepository.findAssignedAreasById`

Add to the existing `libs/database/src/repositories/logins/repository.service.ts`:

```ts
async findAssignedAreasById(
  id: string,
): Promise<ILoginsFindAssignedAreasPromise | void> {
  const promise = await this.repository.logins
    .findUnique({
      where: { id },
      select: {
        assigned_areas: {
          select: {
            areas: {
              select: {
                id: true,
                alias: true,
              },
            },
          },
        },
      },
    })
    .catch((err) => this.repository.errorHandler(err));

  if (promise) return promise;
}
```

Add to `repository.interface.ts`:

```ts
export interface ILoginsFindAssignedAreasPromise {
  assigned_areas: {
    areas: {
      id: string;
      alias: string;
    };
  }[];
}
```

### 1f. Wiring

- `database.module.ts`: add `TicketsRepository` and `TicketMessagesRepository`
  to both `providers` and `exports`.
- `libs/database/src/index.ts`: export both new `repository.interface` and
  `repository.service` files, following the existing export block style.

### Tests

- `repositories/tickets/repository.spec.ts` and
  `repositories/ticket-messages/repository.spec.ts`: the paginator is called
  against a real `$transaction` mock. Mock `DatabaseService` with
  `$transaction` (invoking the callback with a repository stub exposing
  `count` and `findMany`), and assert `findMany` received `take`, `skip`,
  `where`, and `orderBy` derived from the params. Also assert
  `errorHandler` is called when the paginator rejects.
- Extend `repositories/logins/repository.spec.ts` with a
  `describe('findAssignedAreasById')` covering: the `findUnique` argument
  shape, the returned row, and the `errorHandler` path. Do not touch the
  file's existing stale describes.

## Task 2: Domain layer (`libs/account`)

### 2a. `account.interface.ts` additions

`TICKET_RELATIONS` is defined in Task 1 (`@app/database`), not here. Import it
from `@app/database` where needed.

- `IAccountFindTicketsParams` — `{ login_id: string; relation: keyof typeof
  TICKET_RELATIONS; per_page: number; offset?: number; sort: string }`
- `IAccountTicketItemListPromise` — the ticket row fields (`id`, `area_id`,
  `requester_login_id`, `responser_login_id`, `subject`, `description`,
  `priority`, `state`, `created_at`, `updated_at`)
- `IAccountTicketListWithPaginationPromise extends TPaginationData` with
  `data: IAccountTicketItemListPromise[]`
- `IAccountFindMessagesParams` — `{ login_id, per_page, offset?, sort }`
- `IAccountMessageItemListPromise` — `id`, `ticket_id`, `login_id`,
  `message`, `created_at`
- `IAccountMessageListWithPaginationPromise extends TPaginationData`
- `IAccountAreaItemListPromise` — `{ id: string; alias: string }`

### 2b. `AccountService.findTicketsWithPagination`

Injects `TicketsRepository`. Maps `relation` to the where clause:
`requester` → `{ requester_login_id: login_id }`, `responser` →
`{ responser_login_id: login_id }`. Applies `parseSort`. Throws
`UnprocessableEntityException('repository_error')` when the repository
returns a falsy value — same as the existing `findManyWithPagination`.

### 2c. `AccountService.findMessagesWithPagination`

Injects `TicketMessagesRepository`. Where clause `{ login_id }`. Same sort
and error handling.

### 2d. `AccountService.findAssignedAreas`

Signature: `findAssignedAreas(login_id: string): Promise<IAccountAreaItemListPromise[]>`

Cached, following the exact pattern of `validateLogin`:

- `key: 'account:areas'`, `item: login_id`, so the Redis key is
  `account:areas:<login_id>`.
- `get` first; on hit return the cached value directly. An empty array is a
  valid cached value and must be returned without hitting the repository
  (`[]` is truthy in JS, so the existing `if (cache) return cache` idiom is
  correct — do not replace it with a `.length` check).
- On miss, call `this.repository.findAssignedAreasById(login_id)`, flatten
  `assigned_areas` to `{ id, alias }[]`, `set` with `ttl: CACHE_TTL.ten`,
  and return.
- A login with no areas returns `[]`, it is not an error. A repository
  `void` return (login not found) also yields `[]` — do not throw.

Invalidation on write is out of scope; it lands with the areas write layer.

### Tests (`account.service.spec.ts`)

Extend the existing spec. Cover:

- `findTicketsWithPagination`: both relation values produce the right where
  clause; sort is parsed; repository result is returned; falsy repository
  result throws `UnprocessableEntityException`.
- `findMessagesWithPagination`: same shape.
- `findAssignedAreas`: cache hit returns without calling the repository;
  cache miss calls the repository, flattens, and calls `set` with the right
  key/item/ttl; empty cached array short-circuits the repository; repository
  `void` yields `[]`.

## Task 3: Controller layer (`src/controllers/account`)

### 3a. `account.dto.ts` additions

- `IAccountIdParamDTO` — `id` with bare `@IsUUID()` and `@ApiProperty`. Do not
  pass a version argument: the models use `@default(uuid(7))`, and
  `@IsUUID('4')` rejects every real id. Verified against the installed
  validator — the default `all` regex accepts versions 1-8.
- `IAccountTicketsListQueryDTO`:
  - `relation` — required, `@IsIn(Object.keys(TICKET_RELATIONS))` imported from
    `@app/database`, `@ApiProperty` with `enum`.
  - `per_page` — `@IsIn(PAGINATION_OPTIONS.perPage)`, `@IsInt`,
    `@IsNotEmpty`, `@Type(() => Number)` — copy the existing field verbatim.
  - `offset` — optional, same as existing.
  - `sort` — `@IsIn(['created_at', '-created_at', 'updated_at',
    '-updated_at', 'priority', '-priority', 'state', '-state'])`.
- `IAccountMessagesListQueryDTO` — `per_page`, `offset`, and `sort` with
  `@IsIn(['created_at', '-created_at'])`.

### 3b. `account.interface.ts` additions

- `IAccountTicketsListParams` — `{ account: IAuthenticatedAccount; login_id:
  string; query: IAccountTicketsListQueryDTO }`
- `IAccountMessagesListParams` — same with the messages query
- `IAccountAreasListParams` — `{ account, login_id }`

### 3c. `AccountControllerService` additions

Three methods: `findTicketsWithPagination`, `findMessagesWithPagination`,
`findAssignedAreas`.

Each one first enforces the access scope, then delegates to `AccountService`.

The scope rule, extracted into one private helper so it is written once:
the caller may read `login_id` when `account.id === login_id`, or when
`account.role` is `ADMIN` or `MASTER`. Otherwise throw `ForbiddenException`.

### 3d. `account.controller.ts` additions

Three `@Get` handlers — `tickets/:id`, `messages/:id`, `areas/:id` — each
with `@ApiOperation`, `@ApiBearerAuth('bearer')`, and `@ApiResponse` entries
for 200, 401, and 403, matching the style of the existing handlers. Use
`@Param()` with `IAccountIdParamDTO` and `@Query()` with the query DTO.

No `@Roles` decorator on these routes: the scope check in the controller
service covers both the owner case and the admin case, and `@Roles` would
wrongly exclude a `USER` reading their own data.

### Tests

- `account.controller.spec.ts`: extend with a describe per new route,
  asserting delegation to the controller service and error propagation. Note
  the existing describes in this file are stale and already failing — leave
  them alone.
- `account.service.spec.ts` (controller-level): cover the scope helper —
  owner allowed, ADMIN allowed, MASTER allowed, other USER rejected with
  `ForbiddenException` — and delegation for all three methods.
