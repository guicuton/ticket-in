# Areas Controllers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the five `areas` endpoints — paginated list, per-area accounts,
per-area tickets, create, and update — across repository, domain, and HTTP
layers.

**Architecture:** Mirrors the `accounts` vertical already in the repo. Prisma
repositories live in `libs/database/src/repositories/<model>`, the domain
service lives in a new `libs/areas` lib exposed as `@app/areas`, and the HTTP
port lives in `src/controllers/areas` (controller + controller service +
DTOs + interfaces). Reads are paginated through `prisma-offset-paginator`
except the per-area account list, which is unpaginated and Redis-cached.

**Tech Stack:** NestJS 11, Prisma 7 (`prisma-client` generator, output
`libs/database/prisma/generated`), `prisma-offset-paginator`, ioredis,
class-validator / class-transformer, Swagger, Jest + ts-jest.

**Spec:** `docs/plans/areas-controllers-design.md`

## Global Constraints

These bind every task.

- **Working directory for every command is `backend/`.** Tests run with
  `npx jest`.
- **No comments inside methods.** The existing code has none. Swagger and
  decorator metadata are not comments.
- **Naming semantics copy the existing code exactly:**
  - Repository interfaces: `I<Model><Action><Params|Promise>`, e.g.
    `IAreasFindAccountsParams`, `IAreasCreateOnePromise`.
  - Domain interfaces in `libs/areas`: `IArea<Thing><Params|Promise>`.
  - Repository classes: `<Model>Repository` → `AreasRepository`.
  - Spec `describe` names the class under test, with a nested `describe`
    per method.
- **Repository methods return `T | void`** and route Prisma errors through
  `this.repository.errorHandler(err)` — a `.catch()` for single queries, a
  `try/catch` around `offsetPaginator` for paginated ones.
- **Paginated repository methods** pass `bottom: PAGINATION_OPTIONS.aroundRange`
  and return `promise ?? emptyPaginationData()`, because `offsetPaginator`
  returns `undefined` when the page is empty.
- **Sorting** uses `parseSort` from `utils/parse-sort`; DTOs validate the
  allowed values with `@IsIn`, where a leading `-` means descending.
- **All five routes are `@Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)`.**
- **Business rule:** every login linked to an area must exist and have role
  `ADMIN` or `MASTER`. A `USER` is never linked. Violation →
  `UnprocessableEntityException('invalid_area_logins')`.
- **Tests are written before implementation** (TDD).
- **Baseline is red:** `npx jest` reports **7 failed suites / 31 failed tests
  of 99** before any change. Those are stale specs from earlier renames. Do
  not fix them — the single exception is the logins repository spec rename in
  Task 1, which is required to test the new method. Report suite/test counts
  before and after every task.
- **Do not run** `prisma generate`, `npm install`, `git push`, or add any
  dependency.
- **Commit messages carry no co-authorship trailer and no AI attribution.**

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `libs/database/src/repositories/areas/repository.interface.ts` | Params/promise types for `AreasRepository` |
| `libs/database/src/repositories/areas/repository.service.ts` | `AreasRepository` — Prisma adapter for `areas` |
| `libs/database/src/repositories/areas/repository.spec.ts` | Its unit spec |
| `libs/areas/tsconfig.lib.json` | Nest lib tsconfig |
| `libs/areas/src/areas.interface.ts` | Domain params/promise types |
| `libs/areas/src/areas.service.ts` | `AreasService` — domain rules + cache |
| `libs/areas/src/areas.service.spec.ts` | Its unit spec |
| `libs/areas/src/areas.module.ts` | Nest module exporting `AreasService` |
| `libs/areas/src/index.ts` | Public surface of `@app/areas` |
| `src/controllers/areas/areas.dto.ts` | Request DTOs + response models |
| `src/controllers/areas/areas.dto.spec.ts` | DTO validation spec |
| `src/controllers/areas/areas.interface.ts` | Controller-layer param types |
| `src/controllers/areas/areas.service.ts` | `AreasControllerService` |
| `src/controllers/areas/areas.service.spec.ts` | Its unit spec |
| `src/controllers/areas/areas.controller.ts` | `AreasController` — routes + Swagger |
| `src/controllers/areas/areas.controller.spec.ts` | Its unit spec |

**Modified:**

| File | Change |
| --- | --- |
| `libs/database/src/repositories/tickets/repository.interface.ts` | optional `select` |
| `libs/database/src/repositories/tickets/repository.service.ts` | forward `select` |
| `libs/database/src/repositories/tickets/repository.spec.ts` | cover `select` |
| `libs/database/src/repositories/logins/repository.interface.ts` | `ILoginsFindRolesByIdsPromise` |
| `libs/database/src/repositories/logins/repository.service.ts` | `findManyRolesByIds` |
| `libs/database/src/repositories/logins/repository.spec.ts` | stale rename + new describe |
| `libs/database/src/database.module.ts` | register `AreasRepository` |
| `libs/database/src/index.ts` | export the areas repository files |
| `tsconfig.json` | `@app/areas` paths |
| `package.json` | jest `moduleNameMapper` for `@app/areas` |
| `nest-cli.json` | `areas` library project |
| `src/app.module.ts` | import `AreasModule`, swap the stub controller |

**Deleted:**

| File | Reason |
| --- | --- |
| `src/controllers/areas/app.controller.ts` | `getHello` stub replaced by `areas.controller.ts` |

---

## Task 1: Database layer — tickets `select` and login roles

Two small additions the areas domain depends on: the tickets paginator must
be able to shape its rows, and the logins repository must be able to answer
"what roles do these ids have?".

**Files:**
- Modify: `libs/database/src/repositories/tickets/repository.interface.ts`
- Modify: `libs/database/src/repositories/tickets/repository.service.ts`
- Test: `libs/database/src/repositories/tickets/repository.spec.ts`
- Modify: `libs/database/src/repositories/logins/repository.interface.ts`
- Modify: `libs/database/src/repositories/logins/repository.service.ts`
- Test: `libs/database/src/repositories/logins/repository.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ITicketsFindManyWithPaginationParams<Args>` gains `select?: object`
  - `LoginsRepository.findManyRolesByIds(ids: string[]): Promise<ILoginsFindRolesByIdsPromise[] | void>`
  - `ILoginsFindRolesByIdsPromise = { id: string; role: keyof typeof LOGIN_ROLES }`

- [ ] **Step 1: Write the failing test for the tickets `select` passthrough**

Append this `it` inside the existing
`describe('findManyWithPagination')` block in
`libs/database/src/repositories/tickets/repository.spec.ts`:

```ts
    it('should forward select to the underlying findMany when provided', async () => {
      const select = {
        id: true,
        login_requester: { select: { username: true } },
      };

      database.tickets.count.mockResolvedValue(1);
      database.tickets.findMany.mockResolvedValue([{ id: 'ticket-id' }]);

      await repository.findManyWithPagination({ ...params, select });

      expect(database.tickets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ select }),
      );
    });

    it('should not send a select key when none is provided', async () => {
      database.tickets.count.mockResolvedValue(1);
      database.tickets.findMany.mockResolvedValue([{ id: 'ticket-id' }]);

      await repository.findManyWithPagination(params);

      expect(database.tickets.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({ select: expect.anything() }),
      );
    });
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest libs/database/src/repositories/tickets`
Expected: FAIL — TypeScript rejects the `select` property, since
`ITicketsFindManyWithPaginationParams` has no such field.

- [ ] **Step 3: Add `select` to the tickets params interface**

`libs/database/src/repositories/tickets/repository.interface.ts` — the file
becomes:

```ts
export const TICKET_RELATIONS = {
  requester: 'requester',
  responser: 'responser',
} as const;

export interface ITicketsFindManyWithPaginationParams<Args> {
  where: Args;
  offset?: number;
  per_page: number;
  select?: object;
  sort: {
    column: string;
    direction: 'asc' | 'desc';
  };
}
```

- [ ] **Step 4: Forward `select` to the paginator**

In `libs/database/src/repositories/tickets/repository.service.ts`, add one
line to the `offsetPaginator` call, right after `where`:

```ts
        where: prismaParams.where,
        select: prismaParams.select,
```

`offsetPaginator` spreads `...(params.select && { select: params.select })`,
so an `undefined` select never reaches `findMany` — which is exactly what
the second test asserts.

- [ ] **Step 5: Run the tickets spec and confirm it passes**

Run: `npx jest libs/database/src/repositories/tickets`
Expected: PASS, 6 tests.

- [ ] **Step 6: Repair the stale identifiers in the logins spec**

`libs/database/src/repositories/logins/repository.spec.ts` currently imports
a class name that no longer exists, so every test in it fails. Apply the
mechanical rename — and nothing else — from `backend/`:

```bash
sed -i "s/LoginRepository/LoginsRepository/g; s/database\.login\./database.logins./g; s/^\( *\)login: {/\1logins: {/" libs/database/src/repositories/logins/repository.spec.ts
sed -i "s/import { LoginsRepository, LoginsRepository }/import { LoginsRepository }/" libs/database/src/repositories/logins/repository.spec.ts
```

The second `sed` matters: line 3 currently imports
`{ LoginRepository, LoginsRepository }`, and the first rename would leave a
duplicate identifier. Then open the file and confirm three things: the import
reads `import { LoginsRepository } from './repository.service';`, the
`describe` is `LoginsRepository`, and the mock object type and literal both
use the key `logins`.

- [ ] **Step 7: Run the logins spec and confirm the rename alone makes it green**

Run: `npx jest libs/database/src/repositories/logins`
Expected: PASS, 6 tests. If anything still fails, it is a leftover
identifier — fix that identifier only.

- [ ] **Step 8: Commit the rename on its own**

```bash
git add libs/database/src/repositories/logins/repository.spec.ts
git commit -m "test(database): Fix stale identifiers in the logins repository spec"
```

- [ ] **Step 9: Write the failing test for `findManyRolesByIds`**

Add a new `describe` at the end of the `LoginsRepository` spec, as the last
block before the closing `});`:

```ts
  describe('findManyRolesByIds', () => {
    const ids = ['login-a', 'login-b'];

    it('should call logins.findMany with the ids and select only id and role', async () => {
      const expected = [
        { id: 'login-a', role: 'ADMIN' },
        { id: 'login-b', role: 'MASTER' },
      ];

      database.logins.findMany.mockResolvedValue(expected);

      const result = await repository.findManyRolesByIds(ids);

      expect(database.logins.findMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
        select: { id: true, role: true },
      });
      expect(result).toEqual(expected);
    });

    it('should delegate Prisma errors to errorHandler and return undefined when handler swallows', async () => {
      const error = new Error('prisma');

      database.logins.findMany.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.findManyRolesByIds(ids);

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });
```

The spec's mock object does not yet have `logins.findMany`. Add it to both
the `database` type annotation and the literal built in `beforeEach`, next to
the existing `create` / `findUnique` / `findFirst` / `update` entries:

```ts
      findMany: jest.fn(),
```

- [ ] **Step 10: Run it and confirm it fails**

Run: `npx jest libs/database/src/repositories/logins`
Expected: FAIL — `repository.findManyRolesByIds is not a function`.

- [ ] **Step 11: Add the promise type**

Append to `libs/database/src/repositories/logins/repository.interface.ts`:

```ts
export interface ILoginsFindRolesByIdsPromise {
  id: string;
  role: keyof typeof LOGIN_ROLES;
}
```

- [ ] **Step 12: Implement `findManyRolesByIds`**

Add as the last method of `LoginsRepository` in
`libs/database/src/repositories/logins/repository.service.ts`, and add
`ILoginsFindRolesByIdsPromise` to the import list at the top of the file:

```ts
  async findManyRolesByIds(
    ids: string[],
  ): Promise<ILoginsFindRolesByIdsPromise[] | void> {
    const promise = await this.repository.logins
      .findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          role: true,
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }
```

- [ ] **Step 13: Run both specs and confirm they pass**

Run: `npx jest libs/database/src/repositories`
Expected: PASS — logins 8 tests, tickets 6 tests, ticket-messages unchanged.

- [ ] **Step 14: Commit**

```bash
git add libs/database/src/repositories/tickets libs/database/src/repositories/logins
git commit -m "feat(database): Add select passthrough on tickets pagination and role lookup by ids"
```

---

## Task 2: `AreasRepository` — read methods

**Files:**
- Create: `libs/database/src/repositories/areas/repository.interface.ts`
- Create: `libs/database/src/repositories/areas/repository.service.ts`
- Test: `libs/database/src/repositories/areas/repository.spec.ts`
- Modify: `libs/database/src/database.module.ts`
- Modify: `libs/database/src/index.ts`

**Interfaces:**
- Consumes: `emptyPaginationData` from `../pagination`,
  `PAGINATION_OPTIONS` from `configuration/constants`.
- Produces:
  - `AreasRepository.findManyWithPagination<Args>(params: IAreasFindManyWithPaginationParams<Args>): Promise<TPaginationData | void>`
  - `AreasRepository.findAccountsById(params: IAreasFindAccountsParams): Promise<IAreasFindAccountsPromise | void>`
  - `IAreasFindAccountsParams = { id: string; sort: { column: string; direction: 'asc' | 'desc' } }`
  - `IAreasFindAccountsPromise = { logins: { logins: { id: string; username: string; email: string } }[] }`

- [ ] **Step 1: Write the failing spec**

Create `libs/database/src/repositories/areas/repository.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database.service';
import { AreasRepository } from './repository.service';

describe('AreasRepository', () => {
  let repository: AreasRepository;
  let database: {
    areas: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
    errorHandler: jest.Mock;
  };

  beforeEach(async () => {
    database = {
      areas: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(database)),
      errorHandler: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreasRepository,
        { provide: DatabaseService, useValue: database },
      ],
    }).compile();

    repository = module.get(AreasRepository);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findManyWithPagination', () => {
    const params = {
      where: {},
      offset: 10,
      per_page: 30,
      sort: {
        column: 'alias',
        direction: 'asc' as const,
      },
    };

    it('should call areas.findMany with take, skip, orderBy and the logins/tickets counters', async () => {
      database.areas.count.mockResolvedValue(1);
      database.areas.findMany.mockResolvedValue([{ id: 'area-id' }]);

      await repository.findManyWithPagination(params);

      expect(database.areas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: params.per_page,
          skip: params.offset,
          where: params.where,
          orderBy: { alias: 'asc' },
          include: {
            _count: {
              select: {
                logins: true,
                tickets: true,
              },
            },
          },
        }),
      );
    });

    it('should return a well-formed empty page when no records are found', async () => {
      database.areas.count.mockResolvedValue(0);
      database.areas.findMany.mockResolvedValue([]);

      const result = await repository.findManyWithPagination(params);

      expect(result).toEqual({
        data: [],
        meta: { count: 0, totalOfPages: 0, around: [] },
      });
    });

    it('should delegate Prisma errors to errorHandler and return undefined when handler swallows', async () => {
      const error = new Error('prisma');

      database.$transaction.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.findManyWithPagination(params);

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });

  describe('findAccountsById', () => {
    const params = {
      id: 'area-id',
      sort: {
        column: 'username',
        direction: 'asc' as const,
      },
    };

    it('should call areas.findUnique selecting the linked logins ordered by the relation column', async () => {
      const expected = {
        logins: [
          { logins: { id: 'login-a', username: 'admin', email: 'a@b.com' } },
        ],
      };

      database.areas.findUnique.mockResolvedValue(expected);

      const result = await repository.findAccountsById(params);

      expect(database.areas.findUnique).toHaveBeenCalledWith({
        where: { id: params.id },
        select: {
          logins: {
            select: {
              logins: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
            orderBy: {
              logins: {
                username: 'asc',
              },
            },
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('should delegate Prisma errors to errorHandler and return undefined when handler swallows', async () => {
      const error = new Error('prisma');

      database.areas.findUnique.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.findAccountsById(params);

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest libs/database/src/repositories/areas`
Expected: FAIL — `Cannot find module './repository.service'`.

- [ ] **Step 3: Create the interface file**

`libs/database/src/repositories/areas/repository.interface.ts`:

```ts
export interface IAreasFindManyWithPaginationParams<Args> {
  where: Args;
  offset?: number;
  per_page: number;
  sort: {
    column: string;
    direction: 'asc' | 'desc';
  };
}

export interface IAreasFindAccountsParams {
  id: string;
  sort: {
    column: string;
    direction: 'asc' | 'desc';
  };
}

export interface IAreasFindAccountsPromise {
  logins: {
    logins: {
      id: string;
      username: string;
      email: string;
    };
  }[];
}
```

- [ ] **Step 4: Create the repository**

`libs/database/src/repositories/areas/repository.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { offsetPaginator } from 'prisma-offset-paginator';
import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';
import { PAGINATION_OPTIONS } from '../../../../../configuration/constants';
import { DatabaseService } from '../../database.service';
import { emptyPaginationData } from '../pagination';
import {
  IAreasFindAccountsParams,
  IAreasFindAccountsPromise,
  IAreasFindManyWithPaginationParams,
} from './repository.interface';

@Injectable()
export class AreasRepository {
  constructor(private readonly repository: DatabaseService) {}

  async findManyWithPagination<Args>(
    params: IAreasFindManyWithPaginationParams<Args>,
  ): Promise<TPaginationData | void> {
    const { sort, ...prismaParams } = params;

    try {
      const promise = await offsetPaginator({
        instance: this.repository,
        entity: 'areas',
        offset: prismaParams.offset,
        per_page: prismaParams.per_page,
        bottom: PAGINATION_OPTIONS.aroundRange,
        orderBy: sort.column,
        orderDirection: sort.direction,
        where: prismaParams.where,
        include: {
          _count: {
            select: {
              logins: true,
              tickets: true,
            },
          },
        },
      });

      return promise ?? emptyPaginationData();
    } catch (err) {
      this.repository.errorHandler(err as Error);
    }
  }

  async findAccountsById(
    params: IAreasFindAccountsParams,
  ): Promise<IAreasFindAccountsPromise | void> {
    const { id, sort } = params;

    const promise = await this.repository.areas
      .findUnique({
        where: { id },
        select: {
          logins: {
            select: {
              logins: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
            orderBy: {
              logins: {
                [sort.column]: sort.direction,
              },
            },
          },
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }
}
```

- [ ] **Step 5: Run the spec and confirm it passes**

Run: `npx jest libs/database/src/repositories/areas`
Expected: PASS, 6 tests.

- [ ] **Step 6: Register the repository in the database module**

`libs/database/src/database.module.ts` — add the import and list
`AreasRepository` in both `providers` and `exports`, keeping the existing
entries:

```ts
import { AreasRepository } from './repositories/areas/repository.service';
```

```ts
  providers: [
    DatabaseService,
    LoginsRepository,
    TicketsRepository,
    TicketMessagesRepository,
    AreasRepository,
  ],
  exports: [
    DatabaseService,
    LoginsRepository,
    TicketsRepository,
    TicketMessagesRepository,
    AreasRepository,
  ],
```

- [ ] **Step 7: Export it from the lib barrel**

Append to `libs/database/src/index.ts`:

```ts
export * from './repositories/areas/repository.interface';
export * from './repositories/areas/repository.service';
```

- [ ] **Step 8: Run the full suite and confirm nothing regressed**

Run: `npx jest`
Expected: the new areas suite passes; the stale-suite count is now 6 failed
suites / 25 failed tests (the logins spec went green in Task 1).

- [ ] **Step 9: Commit**

```bash
git add libs/database/src/repositories/areas libs/database/src/database.module.ts libs/database/src/index.ts
git commit -m "feat(database): Add areas repository with paginated list and linked accounts read"
```

---

## Task 3: `AreasRepository` — write methods

**Files:**
- Modify: `libs/database/src/repositories/areas/repository.interface.ts`
- Modify: `libs/database/src/repositories/areas/repository.service.ts`
- Test: `libs/database/src/repositories/areas/repository.spec.ts`

**Interfaces:**
- Consumes: `AreasRepository` from Task 2.
- Produces:
  - `AreasRepository.createOne(params: IAreasCreateOneParams): Promise<IAreasCreateOnePromise | void>`
  - `AreasRepository.updateOneById(params: IAreasUpdateOneParams): Promise<IAreasUpdateOnePromise | void>`
  - `IAreasCreateOneParams = { alias: string; description: string; created_at: Date; login_ids: string[] }`
  - `IAreasUpdateOneParams = { id: string; alias?: string; description?: string; login_ids?: string[] }`
  - both promises are `{ id: string }`

- [ ] **Step 1: Extend the spec mock with the write surfaces**

In `libs/database/src/repositories/areas/repository.spec.ts`, extend the
`database` type annotation and the `beforeEach` literal so both carry:

```ts
    areas: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    logins_assigned_areas: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
```

```ts
      areas: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      logins_assigned_areas: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
```

The existing `$transaction: jest.fn((cb) => cb(database))` already runs the
callback against the same mock, so `tx.areas.update` and
`tx.logins_assigned_areas.*` resolve to these mocks.

- [ ] **Step 2: Write the failing tests**

Add two `describe` blocks at the end of the spec, before the final `});`:

```ts
  describe('createOne', () => {
    const params = {
      alias: 'Support',
      description: 'First line support',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      login_ids: ['login-a', 'login-b'],
    };

    it('should create the area with a nested link row per login and return the id', async () => {
      database.areas.create.mockResolvedValue({ id: 'area-id' });

      const result = await repository.createOne(params);

      expect(database.areas.create).toHaveBeenCalledWith({
        data: {
          alias: params.alias,
          description: params.description,
          created_at: params.created_at,
          logins: {
            create: [{ login_id: 'login-a' }, { login_id: 'login-b' }],
          },
        },
        select: { id: true },
      });
      expect(result).toEqual({ id: 'area-id' });
    });

    it('should delegate Prisma errors to errorHandler and return undefined when handler swallows', async () => {
      const error = new Error('prisma');

      database.areas.create.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.createOne(params);

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });

  describe('updateOneById', () => {
    it('should update only the provided scalar fields and leave the links untouched', async () => {
      database.areas.update.mockResolvedValue({ id: 'area-id' });

      const result = await repository.updateOneById({
        id: 'area-id',
        alias: 'Renamed',
      });

      expect(database.areas.update).toHaveBeenCalledWith({
        where: { id: 'area-id' },
        data: { alias: 'Renamed' },
        select: { id: true },
      });
      expect(database.logins_assigned_areas.deleteMany).not.toHaveBeenCalled();
      expect(database.logins_assigned_areas.createMany).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'area-id' });
    });

    it('should replace the whole link set when login_ids is provided', async () => {
      database.areas.update.mockResolvedValue({ id: 'area-id' });

      await repository.updateOneById({
        id: 'area-id',
        login_ids: ['login-a', 'login-b'],
      });

      expect(database.logins_assigned_areas.deleteMany).toHaveBeenCalledWith({
        where: { area_id: 'area-id' },
      });
      expect(database.logins_assigned_areas.createMany).toHaveBeenCalledWith({
        data: [
          { area_id: 'area-id', login_id: 'login-a' },
          { area_id: 'area-id', login_id: 'login-b' },
        ],
      });
    });

    it('should update the area before touching the links so a missing area never reaches the link writes', async () => {
      const error = new Error('prisma');

      database.areas.update.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.updateOneById({
        id: 'missing-area',
        login_ids: ['login-a'],
      });

      expect(database.logins_assigned_areas.deleteMany).not.toHaveBeenCalled();
      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });
```

- [ ] **Step 3: Run and confirm they fail**

Run: `npx jest libs/database/src/repositories/areas`
Expected: FAIL — `repository.createOne is not a function`.

- [ ] **Step 4: Add the write types**

Append to `libs/database/src/repositories/areas/repository.interface.ts`:

```ts
export interface IAreasCreateOneParams {
  alias: string;
  description: string;
  created_at: Date;
  login_ids: string[];
}

export interface IAreasCreateOnePromise {
  id: string;
}

export interface IAreasUpdateOneParams {
  id: string;
  alias?: string;
  description?: string;
  login_ids?: string[];
}

export interface IAreasUpdateOnePromise {
  id: string;
}
```

- [ ] **Step 5: Implement the write methods**

Add both to `AreasRepository` after `findAccountsById`, and extend the
import block at the top of the file with the four new type names:

```ts
  async createOne(
    params: IAreasCreateOneParams,
  ): Promise<IAreasCreateOnePromise | void> {
    const { alias, description, created_at, login_ids } = params;

    const promise = await this.repository.areas
      .create({
        data: {
          alias,
          description,
          created_at,
          logins: {
            create: login_ids.map((login_id) => ({ login_id })),
          },
        },
        select: {
          id: true,
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }

  async updateOneById(
    params: IAreasUpdateOneParams,
  ): Promise<IAreasUpdateOnePromise | void> {
    const { id, alias, description, login_ids } = params;

    const promise = await this.repository
      .$transaction(async (tx) => {
        const area = await tx.areas.update({
          where: { id },
          data: {
            ...(alias && { alias }),
            ...(description && { description }),
          },
          select: {
            id: true,
          },
        });

        if (login_ids) {
          await tx.logins_assigned_areas.deleteMany({
            where: { area_id: id },
          });

          await tx.logins_assigned_areas.createMany({
            data: login_ids.map((login_id) => ({ area_id: id, login_id })),
          });
        }

        return area;
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }
```

- [ ] **Step 6: Run the spec and confirm it passes**

Run: `npx jest libs/database/src/repositories/areas`
Expected: PASS, 11 tests.

- [ ] **Step 7: Commit**

```bash
git add libs/database/src/repositories/areas
git commit -m "feat(database): Add area creation and update with transactional login links"
```

---

## Task 4: `libs/areas` domain lib — scaffolding and reads

**Files:**
- Create: `libs/areas/tsconfig.lib.json`
- Create: `libs/areas/src/areas.interface.ts`
- Create: `libs/areas/src/areas.service.ts`
- Create: `libs/areas/src/areas.module.ts`
- Create: `libs/areas/src/index.ts`
- Test: `libs/areas/src/areas.service.spec.ts`
- Modify: `tsconfig.json`
- Modify: `package.json`
- Modify: `nest-cli.json`

**Interfaces:**
- Consumes: `AreasRepository`, `TicketsRepository` (with `select`) from
  Tasks 1–3; `CacheModuleServices` from `@app/cache`; `parseSort` from
  `utils/parse-sort`.
- Produces:
  - `AreasService.findManyWithPagination(params: IAreasFindManyParams): Promise<IAreaListWithPaginationPromise>`
  - `AreasService.findAccountsByAreaId(params: IAreaFindAccountsParams): Promise<IAreaAccountItemListPromise[]>`
  - `AreasService.findTicketsByAreaId(params: IAreaFindTicketsParams): Promise<IAreaTicketListWithPaginationPromise>`
  - the module `AreasModule`, exported from `@app/areas`

- [ ] **Step 1: Register the lib with the toolchain**

`libs/areas/tsconfig.lib.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../dist/libs/areas"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

`tsconfig.json` — add to `compilerOptions.paths`, keeping alphabetical order
next to `@app/account`:

```json
      "@app/areas": ["libs/areas/src"],
      "@app/areas/*": ["libs/areas/src/*"],
```

`package.json` — add to `jest.moduleNameMapper`:

```json
      "^@app/areas(|/.*)$": "<rootDir>/libs/areas/src/$1",
```

`nest-cli.json` — add to `projects`, after `account`:

```json
    "areas": {
      "type": "library",
      "root": "libs/areas",
      "entryFile": "index",
      "sourceRoot": "libs/areas/src",
      "compilerOptions": {
        "tsConfigPath": "libs/areas/tsconfig.lib.json"
      }
    },
```

- [ ] **Step 2: Create the domain types**

`libs/areas/src/areas.interface.ts`:

```ts
import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';
import {
  TICKET_PRIORITY,
  TICKET_STATE,
} from '../../database/prisma/generated/enums';

export interface IAreasFindManyParams {
  offset?: number;
  per_page: number;
  sort: string;
}

export interface IAreaItemListPromise {
  id: string;
  alias: string;
  description: string;
  created_at: Date;
  _count: {
    logins: number;
    tickets: number;
  };
}

export interface IAreaListWithPaginationPromise extends TPaginationData {
  data: IAreaItemListPromise[];
}

export interface IAreaFindAccountsParams {
  area_id: string;
  sort: string;
}

export interface IAreaAccountItemListPromise {
  id: string;
  username: string;
  email: string;
}

export interface IAreaFindTicketsParams {
  area_id: string;
  offset?: number;
  per_page: number;
  sort: string;
}

export interface IAreaTicketItemListPromise {
  id: string;
  subject: string;
  priority: TICKET_PRIORITY;
  state: TICKET_STATE;
  created_at: Date;
  updated_at: Date;
  login_requester: {
    username: string;
  };
  login_responser: {
    username: string;
  } | null;
}

export interface IAreaTicketListWithPaginationPromise extends TPaginationData {
  data: IAreaTicketItemListPromise[];
}
```

- [ ] **Step 3: Write the failing spec**

`libs/areas/src/areas.service.spec.ts`:

```ts
import { CacheModuleServices } from '@app/cache';
import { AreasRepository, TicketsRepository } from '@app/database';
import { UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_TTL } from '../../../configuration/constants';
import { AreasService } from './areas.service';

describe('AreasService', () => {
  let service: AreasService;
  let cache: jest.Mocked<CacheModuleServices>;
  let repository: jest.Mocked<AreasRepository>;
  let ticketsRepository: jest.Mocked<TicketsRepository>;

  const area_id = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreasService,
        {
          provide: CacheModuleServices,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            deleteCollection: jest.fn(),
          },
        },
        {
          provide: AreasRepository,
          useValue: {
            findManyWithPagination: jest.fn(),
            findAccountsById: jest.fn(),
          },
        },
        {
          provide: TicketsRepository,
          useValue: {
            findManyWithPagination: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AreasService);
    cache = module.get(CacheModuleServices);
    repository = module.get(AreasRepository);
    ticketsRepository = module.get(TicketsRepository);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findManyWithPagination', () => {
    it('should parse the sort and delegate to the repository', async () => {
      const expected = { data: [], meta: {} } as never;

      repository.findManyWithPagination.mockResolvedValue(expected);

      const result = await service.findManyWithPagination({
        per_page: 10,
        offset: 0,
        sort: '-created_at',
      });

      expect(repository.findManyWithPagination).toHaveBeenCalledWith({
        offset: 0,
        per_page: 10,
        sort: { column: 'created_at', direction: 'desc' },
        where: {},
      });
      expect(result).toBe(expected);
    });

    it('should throw UnprocessableEntityException when the repository returns nothing', async () => {
      repository.findManyWithPagination.mockResolvedValue(undefined);

      await expect(
        service.findManyWithPagination({ per_page: 10, sort: 'alias' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('findAccountsByAreaId', () => {
    const accounts = [
      { id: 'login-a', username: 'admin', email: 'a@b.com' },
    ];

    it('should return the cached value and skip the repository', async () => {
      cache.get.mockResolvedValue(accounts);

      const result = await service.findAccountsByAreaId({
        area_id,
        sort: 'username',
      });

      expect(cache.get).toHaveBeenCalledWith({
        key: 'areas:accounts',
        item: `${area_id}:username`,
      });
      expect(repository.findAccountsById).not.toHaveBeenCalled();
      expect(result).toBe(accounts);
    });

    it('should query the repository on a miss, flatten the join rows and cache them', async () => {
      cache.get.mockResolvedValue(undefined);
      repository.findAccountsById.mockResolvedValue({
        logins: accounts.map((item) => ({ logins: item })),
      });

      const result = await service.findAccountsByAreaId({
        area_id,
        sort: '-email',
      });

      expect(repository.findAccountsById).toHaveBeenCalledWith({
        id: area_id,
        sort: { column: 'email', direction: 'desc' },
      });
      expect(cache.set).toHaveBeenCalledWith({
        key: 'areas:accounts',
        item: `${area_id}:-email`,
        data: accounts,
        ttl: CACHE_TTL.ten,
      });
      expect(result).toEqual(accounts);
    });

    it('should return an empty list when the area does not exist', async () => {
      cache.get.mockResolvedValue(undefined);
      repository.findAccountsById.mockResolvedValue(undefined);

      const result = await service.findAccountsByAreaId({
        area_id,
        sort: 'username',
      });

      expect(cache.set).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('findTicketsByAreaId', () => {
    it('should filter by area_id and select the requester and responser usernames', async () => {
      const expected = { data: [], meta: {} } as never;

      ticketsRepository.findManyWithPagination.mockResolvedValue(expected);

      const result = await service.findTicketsByAreaId({
        area_id,
        per_page: 30,
        offset: 30,
        sort: '-priority',
      });

      expect(ticketsRepository.findManyWithPagination).toHaveBeenCalledWith({
        offset: 30,
        per_page: 30,
        sort: { column: 'priority', direction: 'desc' },
        where: { area_id },
        select: {
          id: true,
          subject: true,
          priority: true,
          state: true,
          created_at: true,
          updated_at: true,
          login_requester: { select: { username: true } },
          login_responser: { select: { username: true } },
        },
      });
      expect(result).toBe(expected);
    });

    it('should throw UnprocessableEntityException when the repository returns nothing', async () => {
      ticketsRepository.findManyWithPagination.mockResolvedValue(undefined);

      await expect(
        service.findTicketsByAreaId({
          area_id,
          per_page: 10,
          sort: 'created_at',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });
});
```

- [ ] **Step 4: Run and confirm it fails**

Run: `npx jest libs/areas`
Expected: FAIL — `Cannot find module './areas.service'`.

- [ ] **Step 5: Implement the read side of the service**

`libs/areas/src/areas.service.ts`:

```ts
import { CacheModuleServices } from '@app/cache';
import { AreasRepository, TicketsRepository } from '@app/database';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { CACHE_TTL } from '../../../configuration/constants';
import { parseSort } from '../../../utils/parse-sort';
import { Prisma } from '../../database/prisma/generated/client';
import {
  IAreaAccountItemListPromise,
  IAreaFindAccountsParams,
  IAreaFindTicketsParams,
  IAreaListWithPaginationPromise,
  IAreasFindManyParams,
  IAreaTicketListWithPaginationPromise,
} from './areas.interface';

@Injectable()
export class AreasService {
  constructor(
    private readonly cache: CacheModuleServices,
    private readonly repository: AreasRepository,
    private readonly ticketsRepository: TicketsRepository,
  ) {}

  async findManyWithPagination(
    params: IAreasFindManyParams,
  ): Promise<IAreaListWithPaginationPromise> {
    const { per_page, offset } = params;
    const sort = parseSort(params.sort);

    const repositoryResult =
      await this.repository.findManyWithPagination<Prisma.areasWhereInput>({
        offset,
        per_page,
        sort,
        where: {},
      });

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    return repositoryResult;
  }

  async findAccountsByAreaId(
    params: IAreaFindAccountsParams,
  ): Promise<IAreaAccountItemListPromise[]> {
    const { area_id, sort } = params;

    const cacheKey = 'areas:accounts';
    const cacheItem = [area_id, sort].join(':');
    const cache = await this.cache.get<IAreaAccountItemListPromise[]>({
      key: cacheKey,
      item: cacheItem,
    });

    if (cache) return cache;

    const repositoryResult = await this.repository.findAccountsById({
      id: area_id,
      sort: parseSort(sort),
    });

    if (!repositoryResult) return [];

    const accounts = repositoryResult.logins.map((item) => item.logins);

    await this.cache.set({
      key: cacheKey,
      item: cacheItem,
      data: accounts,
      ttl: CACHE_TTL.ten,
    });

    return accounts;
  }

  async findTicketsByAreaId(
    params: IAreaFindTicketsParams,
  ): Promise<IAreaTicketListWithPaginationPromise> {
    const { area_id, per_page, offset } = params;
    const sort = parseSort(params.sort);

    const repositoryResult =
      await this.ticketsRepository.findManyWithPagination<Prisma.ticketsWhereInput>(
        {
          offset,
          per_page,
          sort,
          where: { area_id },
          select: {
            id: true,
            subject: true,
            priority: true,
            state: true,
            created_at: true,
            updated_at: true,
            login_requester: { select: { username: true } },
            login_responser: { select: { username: true } },
          },
        },
      );

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    return repositoryResult;
  }
}
```

- [ ] **Step 6: Create the module and the barrel**

`libs/areas/src/areas.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AreasService } from './areas.service';

@Module({
  providers: [AreasService],
  exports: [AreasService],
})
export class AreasModule {}
```

`libs/areas/src/index.ts`:

```ts
export * from './areas.module';
export * from './areas.service';
export * from './areas.interface';
```

- [ ] **Step 7: Run the spec and confirm it passes**

Run: `npx jest libs/areas`
Expected: PASS, 8 tests. A `Cannot find module '@app/areas'` failure here
means the `moduleNameMapper` entry in Step 1 is missing or misspelled.

- [ ] **Step 8: Commit**

```bash
git add libs/areas tsconfig.json package.json nest-cli.json
git commit -m "feat(areas): Add areas domain lib with list, accounts and tickets reads"
```

---

## Task 5: Domain writes and cache invalidation

**Files:**
- Modify: `libs/areas/src/areas.interface.ts`
- Modify: `libs/areas/src/areas.service.ts`
- Test: `libs/areas/src/areas.service.spec.ts`

**Interfaces:**
- Consumes: `AreasRepository.createOne` / `.updateOneById` (Task 3),
  `LoginsRepository.findManyRolesByIds` (Task 1).
- Produces:
  - `AreasService.createOne(params: IAreaCreateParams): Promise<IAreaCreatePromise>`
  - `AreasService.updateOneById(params: IAreaUpdateParams): Promise<IAreaUpdatePromise>`
  - `IAreaCreateParams = { alias: string; description: string; logins: string[] }`
  - `IAreaUpdateParams = { id: string; alias?: string; description?: string; logins?: string[] }`
  - both promises are `{ id: string }`

- [ ] **Step 1: Add the write types**

Append to `libs/areas/src/areas.interface.ts`:

```ts
export interface IAreaCreateParams {
  alias: string;
  description: string;
  logins: string[];
}

export interface IAreaCreatePromise {
  id: string;
}

export interface IAreaUpdateParams {
  id: string;
  alias?: string;
  description?: string;
  logins?: string[];
}

export interface IAreaUpdatePromise {
  id: string;
}
```

- [ ] **Step 2: Extend the spec's providers**

In `libs/areas/src/areas.service.spec.ts`, add `LoginsRepository` to the
`@app/database` import, declare
`let loginsRepository: jest.Mocked<LoginsRepository>;`, register the provider,
and read it back in `beforeEach`:

```ts
        {
          provide: LoginsRepository,
          useValue: {
            findManyRolesByIds: jest.fn(),
          },
        },
```

```ts
    loginsRepository = module.get(LoginsRepository);
```

Also extend the existing `AreasRepository` mock with `createOne: jest.fn()`
and `updateOneById: jest.fn()`.

`ILoginsFindRolesByIdsPromise.role` is `keyof typeof LOGIN_ROLES`, not
`string`, so a bare `role: 'ADMIN'` inside an array literal widens to
`string` and fails the typecheck. Declare the fixtures with a helper at the
top of the `describe` and reuse it:

```ts
  const rolesOf = (
    ...entries: [string, 'ADMIN' | 'MASTER' | 'USER'][]
  ): { id: string; role: 'ADMIN' | 'MASTER' | 'USER' }[] =>
    entries.map(([id, role]) => ({ id, role }));
```

so the mocks read `loginsRepository.findManyRolesByIds.mockResolvedValue(
rolesOf(['login-a', 'ADMIN'], ['login-b', 'MASTER']))`. Keep the assertions
exactly as written below; only the fixture construction changes.

- [ ] **Step 3: Write the failing tests**

Add two `describe` blocks at the end of the spec, before the final `});`:

```ts
  describe('createOne', () => {
    const params = {
      alias: 'Support',
      description: 'First line support',
      logins: ['login-a', 'login-b'],
    };

    it('should create the area and invalidate both the areas and the account areas caches', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([
        { id: 'login-a', role: 'ADMIN' },
        { id: 'login-b', role: 'MASTER' },
      ]);
      repository.createOne.mockResolvedValue({ id: area_id });

      const result = await service.createOne(params);

      expect(repository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({
          alias: params.alias,
          description: params.description,
          login_ids: params.logins,
        }),
      );
      expect(cache.deleteCollection).toHaveBeenCalledWith('areas:*');
      expect(cache.deleteCollection).toHaveBeenCalledWith('account:areas:*');
      expect(result).toEqual({ id: area_id });
    });

    it('should reject a login whose role is USER', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([
        { id: 'login-a', role: 'ADMIN' },
        { id: 'login-b', role: 'USER' },
      ]);

      await expect(service.createOne(params)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(repository.createOne).not.toHaveBeenCalled();
    });

    it('should reject when one of the logins does not exist', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([
        { id: 'login-a', role: 'ADMIN' },
      ]);

      await expect(service.createOne(params)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(repository.createOne).not.toHaveBeenCalled();
    });

    it('should deduplicate repeated login ids before validating and creating', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([
        { id: 'login-a', role: 'ADMIN' },
      ]);
      repository.createOne.mockResolvedValue({ id: area_id });

      await service.createOne({ ...params, logins: ['login-a', 'login-a'] });

      expect(loginsRepository.findManyRolesByIds).toHaveBeenCalledWith([
        'login-a',
      ]);
      expect(repository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({ login_ids: ['login-a'] }),
      );
    });

    it('should throw UnprocessableEntityException when the repository returns nothing', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([
        { id: 'login-a', role: 'ADMIN' },
        { id: 'login-b', role: 'MASTER' },
      ]);
      repository.createOne.mockResolvedValue(undefined);

      await expect(service.createOne(params)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(cache.deleteCollection).not.toHaveBeenCalled();
    });
  });

  describe('updateOneById', () => {
    it('should update scalar fields without touching the logins repository', async () => {
      repository.updateOneById.mockResolvedValue({ id: area_id });

      const result = await service.updateOneById({
        id: area_id,
        alias: 'Renamed',
      });

      expect(loginsRepository.findManyRolesByIds).not.toHaveBeenCalled();
      expect(repository.updateOneById).toHaveBeenCalledWith({
        id: area_id,
        alias: 'Renamed',
        description: undefined,
      });
      expect(cache.deleteCollection).toHaveBeenCalledWith('areas:*');
      expect(cache.deleteCollection).toHaveBeenCalledWith('account:areas:*');
      expect(result).toEqual({ id: area_id });
    });

    it('should validate the roles before replacing the link set', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([
        { id: 'login-a', role: 'MASTER' },
      ]);
      repository.updateOneById.mockResolvedValue({ id: area_id });

      await service.updateOneById({ id: area_id, logins: ['login-a'] });

      expect(repository.updateOneById).toHaveBeenCalledWith({
        id: area_id,
        alias: undefined,
        description: undefined,
        login_ids: ['login-a'],
      });
    });

    it('should reject a USER role and never reach the repository', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([
        { id: 'login-a', role: 'USER' },
      ]);

      await expect(
        service.updateOneById({ id: area_id, logins: ['login-a'] }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repository.updateOneById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the area does not exist', async () => {
      repository.updateOneById.mockResolvedValue(undefined);

      await expect(
        service.updateOneById({ id: area_id, alias: 'Renamed' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(cache.deleteCollection).not.toHaveBeenCalled();
    });
  });
```

Add `NotFoundException` to the `@nestjs/common` import at the top of the spec.

- [ ] **Step 4: Run and confirm they fail**

Run: `npx jest libs/areas`
Expected: FAIL — `service.createOne is not a function`.

- [ ] **Step 5: Implement the writes**

In `libs/areas/src/areas.service.ts`: add `LoginsRepository` and
`LOGIN_ROLES` to the `@app/database` import, `NotFoundException` to the
`@nestjs/common` import, the four new types to the `./areas.interface`
import, inject the logins repository as the last constructor argument, and
add the class field plus four methods:

```ts
  private readonly assignableRoles: string[] = [
    LOGIN_ROLES.ADMIN,
    LOGIN_ROLES.MASTER,
  ];
```

```ts
  async createOne(params: IAreaCreateParams): Promise<IAreaCreatePromise> {
    const { alias, description, logins } = params;
    const login_ids = [...new Set(logins)];

    await this.validateAssignableLogins(login_ids);

    const repositoryResult = await this.repository.createOne({
      alias,
      description,
      login_ids,
      created_at: new Date(),
    });

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    await this.invalidateCache();

    return repositoryResult;
  }

  async updateOneById(
    params: IAreaUpdateParams,
  ): Promise<IAreaUpdatePromise> {
    const { id, alias, description, logins } = params;
    const login_ids = logins ? [...new Set(logins)] : undefined;

    if (login_ids) await this.validateAssignableLogins(login_ids);

    const repositoryResult = await this.repository.updateOneById({
      id,
      alias,
      description,
      ...(login_ids && { login_ids }),
    });

    if (!repositoryResult) throw new NotFoundException('area_not_found');

    await this.invalidateCache();

    return repositoryResult;
  }

  private async validateAssignableLogins(login_ids: string[]): Promise<void> {
    const repositoryResult =
      await this.loginsRepository.findManyRolesByIds(login_ids);

    if (!repositoryResult || repositoryResult.length !== login_ids.length)
      throw new UnprocessableEntityException('invalid_area_logins');

    const hasForbiddenRole = repositoryResult.some(
      (item) => !this.assignableRoles.includes(item.role),
    );

    if (hasForbiddenRole)
      throw new UnprocessableEntityException('invalid_area_logins');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache.deleteCollection('areas:*');
    await this.cache.deleteCollection('account:areas:*');
  }
```

- [ ] **Step 6: Run the spec and confirm it passes**

Run: `npx jest libs/areas`
Expected: PASS, 17 tests.

- [ ] **Step 7: Commit**

```bash
git add libs/areas
git commit -m "feat(areas): Add area create and update with role rules and cache invalidation"
```

---

## Task 6: Controller DTOs and interfaces

**Files:**
- Create: `src/controllers/areas/areas.dto.ts`
- Create: `src/controllers/areas/areas.interface.ts`
- Test: `src/controllers/areas/areas.dto.spec.ts`

**Interfaces:**
- Consumes: `IAreaCreatePromise`, `IAreaUpdatePromise` from `@app/areas`;
  `PAGINATION_OPTIONS` from `configuration/constants`.
- Produces: `IAreaIdParamDTO`, `IAreasListQueryDTO`,
  `IAreaAccountsListQueryDTO`, `IAreaTicketsListQueryDTO`, `IAreaCreateDTO`,
  `IAreaUpdateDTO`, `IAreaCreateResponseDTO`, `IAreaUpdateResponseDTO`, and
  the controller param types `IAreaAccountsListParams`,
  `IAreaTicketsListParams`, `IAreaCreateControllerParams`,
  `IAreaUpdateControllerParams`.

- [ ] **Step 1: Write the failing DTO spec**

`src/controllers/areas/areas.dto.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  IAreaCreateDTO,
  IAreasListQueryDTO,
  IAreaTicketsListQueryDTO,
  IAreaUpdateDTO,
} from './areas.dto';

describe('IAreasListQueryDTO', () => {
  it('should accept a supported sort value', async () => {
    const dto = plainToInstance(IAreasListQueryDTO, {
      per_page: 10,
      sort: '-alias',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject a sort value outside the allowed list', async () => {
    const dto = plainToInstance(IAreasListQueryDTO, {
      per_page: 10,
      sort: 'description',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'sort')).toBe(true);
  });

  it('should reject a negative offset', async () => {
    const dto = plainToInstance(IAreasListQueryDTO, {
      per_page: 10,
      sort: 'alias',
      offset: -1,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'offset')).toBe(true);
  });
});

describe('IAreaTicketsListQueryDTO', () => {
  it('should accept sorting by subject', async () => {
    const dto = plainToInstance(IAreaTicketsListQueryDTO, {
      per_page: 30,
      sort: 'subject',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject sorting by state', async () => {
    const dto = plainToInstance(IAreaTicketsListQueryDTO, {
      per_page: 30,
      sort: 'state',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'sort')).toBe(true);
  });
});

describe('IAreaCreateDTO', () => {
  const valid = {
    alias: 'Support',
    description: 'First line support',
    logins: ['00000000-0000-0000-0000-000000000001'],
  };

  it('should accept a well-formed payload', async () => {
    const errors = await validate(plainToInstance(IAreaCreateDTO, valid));

    expect(errors).toHaveLength(0);
  });

  it('should reject an empty logins array', async () => {
    const dto = plainToInstance(IAreaCreateDTO, { ...valid, logins: [] });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'logins')).toBe(true);
  });

  it('should reject a login id that is not a uuid', async () => {
    const dto = plainToInstance(IAreaCreateDTO, {
      ...valid,
      logins: ['not-a-uuid'],
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'logins')).toBe(true);
  });

  it('should reject an alias longer than 100 characters', async () => {
    const dto = plainToInstance(IAreaCreateDTO, {
      ...valid,
      alias: 'a'.repeat(101),
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'alias')).toBe(true);
  });
});

describe('IAreaUpdateDTO', () => {
  it('should accept a payload carrying only the description', async () => {
    const dto = plainToInstance(IAreaUpdateDTO, {
      description: 'Second line support',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an empty logins array when the key is present', async () => {
    const dto = plainToInstance(IAreaUpdateDTO, { logins: [] });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'logins')).toBe(true);
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npx jest src/controllers/areas`
Expected: FAIL — `Cannot find module './areas.dto'`.

- [ ] **Step 3: Write the DTOs**

`src/controllers/areas/areas.dto.ts`:

```ts
import { IAreaCreatePromise, IAreaUpdatePromise } from '@app/areas';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PAGINATION_OPTIONS } from '../../../configuration/constants';

export class IAreaIdParamDTO {
  @ApiProperty({
    description: 'Area id',
    example: '00000000-0000-0000-0000-000000000001',
    format: 'uuid',
  })
  @IsUUID()
  id: string;
}

export class IAreasListQueryDTO {
  @ApiPropertyOptional({
    description: 'Set the offset page for pagination',
    example: '0',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @ApiProperty({
    description: 'Items per page',
    example: '10',
    type: 'number',
  })
  @IsIn(PAGINATION_OPTIONS.perPage)
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  per_page: number;

  @ApiProperty({
    description: 'Column sorter',
    example: 'alias',
    type: 'string',
    enum: ['alias', '-alias', 'created_at', '-created_at'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['alias', '-alias', 'created_at', '-created_at'])
  sort: string;
}

export class IAreaAccountsListQueryDTO {
  @ApiProperty({
    description: 'Column sorter over the linked login',
    example: 'username',
    type: 'string',
    enum: ['username', '-username', 'email', '-email'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['username', '-username', 'email', '-email'])
  sort: string;
}

export class IAreaTicketsListQueryDTO {
  @ApiPropertyOptional({
    description: 'Set the offset page for pagination',
    example: '0',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @ApiProperty({
    description: 'Items per page',
    example: '10',
    type: 'number',
  })
  @IsIn(PAGINATION_OPTIONS.perPage)
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  per_page: number;

  @ApiProperty({
    description: 'Column sorter',
    example: 'created_at',
    type: 'string',
    enum: [
      'created_at',
      '-created_at',
      'updated_at',
      '-updated_at',
      'priority',
      '-priority',
      'subject',
      '-subject',
    ],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'created_at',
    '-created_at',
    'updated_at',
    '-updated_at',
    'priority',
    '-priority',
    'subject',
    '-subject',
  ])
  sort: string;
}

export class IAreaCreateDTO {
  @ApiProperty({
    description: 'Area alias',
    example: 'Support',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  alias: string;

  @ApiProperty({
    description: 'Area description',
    example: 'First line support',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiProperty({
    description: 'Logins assigned to the area. ADMIN or MASTER only',
    example: ['00000000-0000-0000-0000-000000000001'],
    type: [String],
    format: 'uuid',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  logins: string[];
}

export class IAreaUpdateDTO {
  @ApiPropertyOptional({
    description: 'Area alias',
    example: 'Support',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  alias?: string;

  @ApiPropertyOptional({
    description: 'Area description',
    example: 'First line support',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({
    description: 'Replacement set of logins. ADMIN or MASTER only',
    example: ['00000000-0000-0000-0000-000000000001'],
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  logins?: string[];
}

export class IAreaCreateResponseDTO implements IAreaCreatePromise {
  @ApiProperty({ format: 'uuid' })
  id: string;
}

export class IAreaUpdateResponseDTO implements IAreaUpdatePromise {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
```

`@IsUUID()` takes no version argument on purpose: ids are `uuid(7)` and
`@IsUUID('4')` would reject every real id.

- [ ] **Step 4: Write the controller param types**

`src/controllers/areas/areas.interface.ts`:

```ts
import type { IAuthenticatedAccount } from '@app/auth';
import {
  IAreaAccountsListQueryDTO,
  IAreaCreateDTO,
  IAreaTicketsListQueryDTO,
  IAreaUpdateDTO,
} from './areas.dto';

export interface IAreaAccountsListParams {
  area_id: string;
  query: IAreaAccountsListQueryDTO;
}

export interface IAreaTicketsListParams {
  area_id: string;
  query: IAreaTicketsListQueryDTO;
}

export interface IAreaCreateControllerParams {
  body: IAreaCreateDTO;
  ip: string;
  account: IAuthenticatedAccount;
}

export interface IAreaUpdateControllerParams {
  id: string;
  body: IAreaUpdateDTO;
  ip: string;
  account: IAuthenticatedAccount;
}
```

- [ ] **Step 5: Run the spec and confirm it passes**

Run: `npx jest src/controllers/areas`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add src/controllers/areas/areas.dto.ts src/controllers/areas/areas.dto.spec.ts src/controllers/areas/areas.interface.ts
git commit -m "feat(areas): Add areas controller DTOs and param interfaces"
```

---

## Task 7: Controller service, controller, and module wiring

**Files:**
- Create: `src/controllers/areas/areas.service.ts`
- Test: `src/controllers/areas/areas.service.spec.ts`
- Create: `src/controllers/areas/areas.controller.ts`
- Test: `src/controllers/areas/areas.controller.spec.ts`
- Delete: `src/controllers/areas/app.controller.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: everything produced by Tasks 4–6.
- Produces: `AreasControllerService` with `findAllWithPagination`,
  `findAccounts`, `findTicketsWithPagination`, `createOne`, `updateOneById`;
  and `AreasController` serving `GET areas/list`, `GET areas/:id/accounts`,
  `GET areas/:id/tickets`, `POST areas/create`, `PUT areas/:id`.

- [ ] **Step 1: Write the failing controller-service spec**

`src/controllers/areas/areas.service.spec.ts`:

```ts
import { AreasService } from '@app/areas';
import type { IAuthenticatedAccount } from '@app/auth';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AreasControllerService } from './areas.service';

describe('AreasControllerService', () => {
  let controllerService: AreasControllerService;
  let areasService: jest.Mocked<AreasService>;

  const account: IAuthenticatedAccount = {
    username: 'admin',
    id: '00000000-0000-0000-0000-000000000001',
    role: 'MASTER',
  };
  const area_id = '00000000-0000-0000-0000-000000000002';
  const ip = '127.0.0.1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreasControllerService,
        {
          provide: AreasService,
          useValue: {
            findManyWithPagination: jest.fn(),
            findAccountsByAreaId: jest.fn(),
            findTicketsByAreaId: jest.fn(),
            createOne: jest.fn(),
            updateOneById: jest.fn(),
          },
        },
      ],
    }).compile();

    controllerService = module.get(AreasControllerService);
    areasService = module.get(AreasService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controllerService).toBeDefined();
  });

  describe('findAllWithPagination', () => {
    it('should delegate the query to the domain service', async () => {
      const query = { per_page: 10, sort: 'alias' };
      const expected = { data: [], meta: {} } as never;

      areasService.findManyWithPagination.mockResolvedValue(expected);

      const result = await controllerService.findAllWithPagination(query);

      expect(areasService.findManyWithPagination).toHaveBeenCalledWith(query);
      expect(result).toBe(expected);
    });
  });

  describe('findAccounts', () => {
    it('should merge the area id with the query', async () => {
      areasService.findAccountsByAreaId.mockResolvedValue([]);

      await controllerService.findAccounts({
        area_id,
        query: { sort: 'username' },
      });

      expect(areasService.findAccountsByAreaId).toHaveBeenCalledWith({
        area_id,
        sort: 'username',
      });
    });
  });

  describe('findTicketsWithPagination', () => {
    it('should merge the area id with the query', async () => {
      const expected = { data: [], meta: {} } as never;

      areasService.findTicketsByAreaId.mockResolvedValue(expected);

      const result = await controllerService.findTicketsWithPagination({
        area_id,
        query: { per_page: 10, offset: 0, sort: 'created_at' },
      });

      expect(areasService.findTicketsByAreaId).toHaveBeenCalledWith({
        area_id,
        per_page: 10,
        offset: 0,
        sort: 'created_at',
      });
      expect(result).toBe(expected);
    });
  });

  describe('createOne', () => {
    const body = {
      alias: 'Support',
      description: 'First line support',
      logins: ['00000000-0000-0000-0000-000000000003'],
    };

    it('should delegate the body and return the created id', async () => {
      areasService.createOne.mockResolvedValue({ id: area_id });

      const result = await controllerService.createOne({ body, ip, account });

      expect(areasService.createOne).toHaveBeenCalledWith(body);
      expect(result).toEqual({ id: area_id });
    });

    it('should propagate errors thrown by the domain service', async () => {
      const error = new Error('domain');

      areasService.createOne.mockRejectedValue(error);

      await expect(
        controllerService.createOne({ body, ip, account }),
      ).rejects.toBe(error);
    });
  });

  describe('updateOneById', () => {
    it('should merge the id with the body', async () => {
      areasService.updateOneById.mockResolvedValue({ id: area_id });

      const result = await controllerService.updateOneById({
        id: area_id,
        body: { alias: 'Renamed' },
        ip,
        account,
      });

      expect(areasService.updateOneById).toHaveBeenCalledWith({
        id: area_id,
        alias: 'Renamed',
      });
      expect(result).toEqual({ id: area_id });
    });

    it('should reject an empty body before reaching the domain service', async () => {
      await expect(
        controllerService.updateOneById({ id: area_id, body: {}, ip, account }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(areasService.updateOneById).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npx jest src/controllers/areas/areas.service`
Expected: FAIL — `Cannot find module './areas.service'`.

- [ ] **Step 3: Implement the controller service**

`src/controllers/areas/areas.service.ts`:

```ts
import {
  AreasService,
  IAreaAccountItemListPromise,
  IAreaCreatePromise,
  IAreaListWithPaginationPromise,
  IAreaTicketListWithPaginationPromise,
  IAreaUpdatePromise,
} from '@app/areas';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IAreasListQueryDTO } from './areas.dto';
import {
  IAreaAccountsListParams,
  IAreaCreateControllerParams,
  IAreaTicketsListParams,
  IAreaUpdateControllerParams,
} from './areas.interface';

@Injectable()
export class AreasControllerService {
  private readonly logger = new Logger(AreasControllerService.name);

  constructor(private readonly areasService: AreasService) {}

  async findAllWithPagination(
    query: IAreasListQueryDTO,
  ): Promise<IAreaListWithPaginationPromise> {
    return await this.areasService.findManyWithPagination({
      ...query,
    });
  }

  async findAccounts(
    params: IAreaAccountsListParams,
  ): Promise<IAreaAccountItemListPromise[]> {
    const { area_id, query } = params;

    return await this.areasService.findAccountsByAreaId({
      area_id,
      ...query,
    });
  }

  async findTicketsWithPagination(
    params: IAreaTicketsListParams,
  ): Promise<IAreaTicketListWithPaginationPromise> {
    const { area_id, query } = params;

    return await this.areasService.findTicketsByAreaId({
      area_id,
      ...query,
    });
  }

  async createOne(
    params: IAreaCreateControllerParams,
  ): Promise<IAreaCreatePromise> {
    const { body, ip, account } = params;

    const serviceResult = await this.areasService.createOne(body);

    this.logger.log(
      `[createOne] - LOGINID:${account.id} | AREAID:${serviceResult.id} | IP:${ip} - AREA CREATED`,
    );

    return serviceResult;
  }

  async updateOneById(
    params: IAreaUpdateControllerParams,
  ): Promise<IAreaUpdatePromise> {
    const { id, body, ip, account } = params;

    if (
      body.alias === undefined &&
      body.description === undefined &&
      body.logins === undefined
    ) {
      throw new BadRequestException('empty_payload');
    }

    const serviceResult = await this.areasService.updateOneById({
      id,
      ...body,
    });

    this.logger.log(
      `[updateOneById] - LOGINID:${account.id} | AREAID:${serviceResult.id} | IP:${ip} - AREA UPDATED`,
    );

    return serviceResult;
  }
}
```

- [ ] **Step 4: Run the spec and confirm it passes**

Run: `npx jest src/controllers/areas/areas.service`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the failing controller spec**

`src/controllers/areas/areas.controller.spec.ts`:

```ts
import type { IAuthenticatedAccount } from '@app/auth';
import { Test, TestingModule } from '@nestjs/testing';
import { AreasController } from './areas.controller';
import { AreasControllerService } from './areas.service';

describe('AreasController', () => {
  let controller: AreasController;
  let controllerService: jest.Mocked<AreasControllerService>;

  const account: IAuthenticatedAccount = {
    username: 'admin',
    id: '00000000-0000-0000-0000-000000000001',
    role: 'MASTER',
  };
  const area_id = '00000000-0000-0000-0000-000000000002';
  const ip = '127.0.0.1';

  beforeEach(async () => {
    const serviceMock = {
      findAllWithPagination: jest.fn(),
      findAccounts: jest.fn(),
      findTicketsWithPagination: jest.fn(),
      createOne: jest.fn(),
      updateOneById: jest.fn(),
    } as unknown as jest.Mocked<AreasControllerService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AreasController],
      providers: [
        { provide: AreasControllerService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get(AreasController);
    controllerService = module.get(AreasControllerService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('should delegate the query to the controller service', async () => {
      const query = { per_page: 10, sort: 'alias' };
      const expected = { data: [], meta: {} } as never;

      controllerService.findAllWithPagination.mockResolvedValue(expected);

      const result = await controller.list(query);

      expect(controllerService.findAllWithPagination).toHaveBeenCalledWith(
        query,
      );
      expect(result).toBe(expected);
    });

    it('should propagate errors thrown by the controller service', async () => {
      const error = new Error('service');

      controllerService.findAllWithPagination.mockRejectedValue(error);

      await expect(
        controller.list({ per_page: 10, sort: 'alias' }),
      ).rejects.toBe(error);
    });
  });

  describe('accounts', () => {
    it('should pass the id param as area_id', async () => {
      controllerService.findAccounts.mockResolvedValue([]);

      await controller.accounts({ id: area_id }, { sort: 'username' });

      expect(controllerService.findAccounts).toHaveBeenCalledWith({
        area_id,
        query: { sort: 'username' },
      });
    });
  });

  describe('tickets', () => {
    it('should pass the id param as area_id', async () => {
      const expected = { data: [], meta: {} } as never;
      const query = { per_page: 10, sort: 'created_at' };

      controllerService.findTicketsWithPagination.mockResolvedValue(expected);

      const result = await controller.tickets({ id: area_id }, query);

      expect(controllerService.findTicketsWithPagination).toHaveBeenCalledWith({
        area_id,
        query,
      });
      expect(result).toBe(expected);
    });
  });

  describe('create', () => {
    const body = {
      alias: 'Support',
      description: 'First line support',
      logins: ['00000000-0000-0000-0000-000000000003'],
    };

    it('should return the created id', async () => {
      controllerService.createOne.mockResolvedValue({ id: area_id });

      const result = await controller.create(account, ip, body);

      expect(controllerService.createOne).toHaveBeenCalledWith({
        body,
        ip,
        account,
      });
      expect(result).toEqual({ id: area_id });
    });

    it('should propagate errors thrown by the controller service', async () => {
      const error = new Error('service');

      controllerService.createOne.mockRejectedValue(error);

      await expect(controller.create(account, ip, body)).rejects.toBe(error);
    });
  });

  describe('update', () => {
    it('should pass the id param, the body, the ip and the account', async () => {
      const body = { alias: 'Renamed' };

      controllerService.updateOneById.mockResolvedValue({ id: area_id });

      const result = await controller.update(
        account,
        ip,
        { id: area_id },
        body,
      );

      expect(controllerService.updateOneById).toHaveBeenCalledWith({
        id: area_id,
        body,
        ip,
        account,
      });
      expect(result).toEqual({ id: area_id });
    });
  });
});
```

- [ ] **Step 6: Run and confirm it fails**

Run: `npx jest src/controllers/areas/areas.controller`
Expected: FAIL — `Cannot find module './areas.controller'`.

- [ ] **Step 7: Implement the controller**

Create `src/controllers/areas/areas.controller.ts` and delete
`src/controllers/areas/app.controller.ts`:

```ts
import {
  IAreaAccountItemListPromise,
  IAreaCreatePromise,
  IAreaListWithPaginationPromise,
  IAreaTicketListWithPaginationPromise,
  IAreaUpdatePromise,
} from '@app/areas';
import type { IAuthenticatedAccount } from '@app/auth';
import { LOGIN_ROLES } from '@app/database';
import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Account } from '../../../decorators/account.decorator';
import { Roles } from '../../../decorators/roles.decorator';
import {
  IAreaAccountsListQueryDTO,
  IAreaCreateDTO,
  IAreaCreateResponseDTO,
  IAreaIdParamDTO,
  IAreasListQueryDTO,
  IAreaTicketsListQueryDTO,
  IAreaUpdateDTO,
  IAreaUpdateResponseDTO,
} from './areas.dto';
import { AreasControllerService } from './areas.service';

@ApiTags('Areas')
@Controller('areas')
export class AreasController {
  constructor(private readonly controllerService: AreasControllerService) {}

  @ApiOperation({
    summary: 'Get areas list',
    description:
      'Return a paginated list of areas with the number of linked logins and tickets.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(IAreasListQueryDTO)
  @ApiResponse({ status: 200, description: 'Areas list.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request query.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Get('list')
  async list(
    @Query() query: IAreasListQueryDTO,
  ): Promise<IAreaListWithPaginationPromise> {
    return await this.controllerService.findAllWithPagination(query);
  }

  @ApiOperation({
    summary: 'Get accounts assigned to an area',
    description:
      'Return the full list of logins assigned to the given area, without pagination.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(IAreaAccountsListQueryDTO)
  @ApiResponse({ status: 200, description: 'Assigned accounts list.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request params/query.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Get(':id/accounts')
  async accounts(
    @Param() params: IAreaIdParamDTO,
    @Query() query: IAreaAccountsListQueryDTO,
  ): Promise<IAreaAccountItemListPromise[]> {
    return await this.controllerService.findAccounts({
      area_id: params.id,
      query,
    });
  }

  @ApiOperation({
    summary: 'Get tickets assigned to an area',
    description:
      'Return a paginated list of the tickets assigned to the given area.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(IAreaTicketsListQueryDTO)
  @ApiResponse({ status: 200, description: 'Tickets list.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request params/query.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Get(':id/tickets')
  async tickets(
    @Param() params: IAreaIdParamDTO,
    @Query() query: IAreaTicketsListQueryDTO,
  ): Promise<IAreaTicketListWithPaginationPromise> {
    return await this.controllerService.findTicketsWithPagination({
      area_id: params.id,
      query,
    });
  }

  @ApiOperation({
    summary: 'Create new area',
    description:
      'Creates an area already linked to one or more ADMIN/MASTER logins.',
  })
  @ApiBearerAuth('bearer')
  @ApiBody({ type: IAreaCreateDTO })
  @ApiResponse({
    status: 201,
    description: 'Area created successfully.',
    type: IAreaCreateResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request body.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @ApiResponse({
    status: 422,
    description: 'One of the logins does not exist or is not an ADMIN/MASTER.',
  })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Post('create')
  async create(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Body() body: IAreaCreateDTO,
  ): Promise<IAreaCreatePromise> {
    return await this.controllerService.createOne({
      body,
      ip,
      account,
    });
  }

  @ApiOperation({
    summary: 'Update an area',
    description:
      'Updates the alias, the description, or the whole set of logins linked to the area.',
  })
  @ApiBearerAuth('bearer')
  @ApiBody({ type: IAreaUpdateDTO })
  @ApiResponse({
    status: 200,
    description: 'Area updated successfully.',
    type: IAreaUpdateResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed, or the request body is empty.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @ApiResponse({ status: 404, description: 'Area not found.' })
  @ApiResponse({
    status: 422,
    description: 'One of the logins does not exist or is not an ADMIN/MASTER.',
  })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Put(':id')
  async update(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Param() params: IAreaIdParamDTO,
    @Body() body: IAreaUpdateDTO,
  ): Promise<IAreaUpdatePromise> {
    return await this.controllerService.updateOneById({
      id: params.id,
      body,
      ip,
      account,
    });
  }
}
```

- [ ] **Step 8: Wire the module**

In `src/app.module.ts`: replace the
`import { AreasController } from './controllers/areas/app.controller';` line
with `import { AreasController } from './controllers/areas/areas.controller';`,
add `import { AreasModule } from '@app/areas';` and
`import { AreasControllerService } from './controllers/areas/areas.service';`,
list `AreasModule` in `imports` after `AccountModule`, and add
`AreasControllerService` to `providers` next to `AccountControllerService`.
The `controllers` array already lists `AreasController`.

- [ ] **Step 9: Run the areas specs and confirm they pass**

Run: `npx jest src/controllers/areas`
Expected: PASS — controller 8 tests, controller service 8 tests, DTOs 11
tests.

- [ ] **Step 10: Typecheck the whole build**

Run: `npx tsc --noEmit -p tsconfig.json`

The typecheck baseline is also dirty: **19 errors** before any change, all in
stale specs — `libs/account/src/account.service.spec.ts` (7),
`src/controllers/account/account.service.spec.ts` (7),
`src/controllers/account/account.controller.spec.ts` (2),
`libs/auth/src/strategies/local.strategy.spec.ts` (2), and
`libs/database/src/repositories/logins/repository.spec.ts` (1, removed by the
Task 1 rename).

Expected now: **18 errors, none of them in a file this plan created or
modified**. This is the only step that catches a broken `@app/areas` path
mapping or a Prisma type mismatch, since jest compiles each file in
isolation.

- [ ] **Step 11: Run the full suite**

Run: `npx jest`
Expected: the six new suites pass; the failing suites are the 6 stale ones
carried over (25 failed tests). Compare against the Task 1 baseline and
report the exact numbers.

- [ ] **Step 12: Commit**

```bash
git add src/controllers/areas src/app.module.ts
git commit -m "feat(areas): Add areas controller with list, accounts, tickets, create and update"
```

---

## Verification

- [ ] `npx jest` — new suites green, stale suites unchanged at 6 failed / 25
  failed tests, and no previously-passing test broken.
- [ ] `npx tsc --noEmit -p tsconfig.json` — 18 errors, all in the stale specs
  named in Task 7 Step 10, none in a file this plan touched.
- [ ] `npx eslint libs/areas src/controllers/areas libs/database/src/repositories/areas`
  — clean. Do not lint the whole tree: the generated Prisma client and the
  stale specs already produce 67 errors on `main`.
- [ ] Swagger renders: the five routes appear under the `Areas` tag with the
  right verbs and params.
- [ ] `git log --format='%an %ae%n%b'` on the branch — no co-authorship
  trailer, no AI attribution anywhere.
