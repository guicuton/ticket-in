# Tickets Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `tickets` domain — list, detail, message thread, create, and update — as a new `@app/tickets` library plus a `tickets` HTTP controller.

**Architecture:** Four layers, copied from the `areas` domain that already ships: Prisma repository (adapter) → domain service in `libs/tickets` (business rules, cache, validation) → controller service in `src/controllers/tickets` (request shaping, audit logging) → controller (routing, Swagger, guards). The one novel piece is a role-based visibility scope that turns the authenticated account into a Prisma `where` fragment.

**Tech Stack:** NestJS 11, Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`), `prisma-offset-paginator`, ioredis, class-validator / class-transformer, Jest + ts-jest.

**Spec:** `docs/plans/tickets-domain-design.md`

## Global Constraints

- **No co-authorship or AI attribution in any commit message.** No `Co-Authored-By` trailer, no "generated with" line, no trailer block of any kind.
- **Never run lint or format commands.** The IDE formats on save. `jest` and `tsc` are the only verification tools.
- **Never run `git push`, `git pull`, or any remote git operation.**
- **Never run `prisma generate`, `npm install`, or add a dependency.**
- **Never edit `schema.prisma` and never create a migration.** Every index this plan relies on already exists.
- **Every UUID literal — DTO `example` values and test fixtures alike — uses the pattern `019538c4-2f7a-7c31-9c1b-<12 digits>`.** A zero-filled placeholder fails `@IsUUID()` because its version nibble is `0`.
- **Do not touch the six failing suites inherited from `main`**: `libs/account/src/account.service.spec.ts`, `libs/auth/src/strategies/jwt.strategy.spec.ts`, `libs/auth/src/strategies/local.strategy.spec.ts`, `libs/database/src/database.service.spec.ts`, `src/controllers/account/account.controller.spec.ts`, `src/controllers/account/account.service.spec.ts`. Baseline is **25 failing of 159 tests, 6 failing suites, 18 `tsc` errors**. Your task is judged on not making those numbers worse and on your own new tests passing.
- **Never delete or rewrite an existing test.** Several spec files this plan touches already exist and already pass. Before writing any spec file, check whether it is there — if it is, APPEND a `describe` block and merge your mocks into its existing `beforeEach`. A task that ends with fewer tests in a file than it started with has failed, whatever the plan text says.
- All commands run from `backend/`. Run tests scoped to your own files: `npx jest <path>`.
- Type-check with `npx tsc --noEmit -p tsconfig.json`. Count errors with `| grep -c 'error TS'` and compare against 18.

---

### Task 1: Tickets repository — constants, `findOne`, `createOne`, `updateOneById`

**Files:**
- Modify: `backend/libs/database/src/repositories/tickets/repository.interface.ts`
- Modify: `backend/libs/database/src/repositories/tickets/repository.service.ts`
- Test: `backend/libs/database/src/repositories/tickets/repository.spec.ts` (create)

**Interfaces:**
- Consumes: `DatabaseService` (already injected), `emptyPaginationData`.
- Produces: `TICKET_PRIORITIES`, `TICKET_STATES`, `ITicketsFindOneParams<Args>`, `ITicketsFindOnePromise`, `ITicketsCreateOneParams`, `ITicketsCreateOnePromise`, `ITicketsUpdateOneParams`, `ITicketsUpdateOnePromise`, and the methods `findOne`, `createOne`, `updateOneById` on `TicketsRepository`.

**Do NOT modify `findManyWithPagination`.** It already forwards `select`, which is all the list route needs.

- [ ] **Step 1: Write the failing test**

Create `backend/libs/database/src/repositories/tickets/repository.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database.service';
import { TicketsRepository } from './repository.service';
import {
  ITicketsCreateOneParams,
  ITicketsUpdateOneParams,
} from './repository.interface';

describe('TicketsRepository', () => {
  let repository: TicketsRepository;
  let database: {
    tickets: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    errorHandler: jest.Mock;
  };

  const ticketId = '019538c4-2f7a-7c31-9c1b-000000000001';
  const loginId = '019538c4-2f7a-7c31-9c1b-000000000002';
  const areaId = '019538c4-2f7a-7c31-9c1b-000000000003';

  beforeEach(async () => {
    database = {
      tickets: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      errorHandler: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsRepository,
        { provide: DatabaseService, useValue: database },
      ],
    }).compile();

    repository = module.get(TicketsRepository);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findOne', () => {
    it('should forward the where and select the relations plus the message count', async () => {
      const expected = { id: ticketId };
      database.tickets.findFirst.mockResolvedValue(expected);

      const result = await repository.findOne({ where: { id: ticketId } });

      expect(database.tickets.findFirst).toHaveBeenCalledWith({
        where: { id: ticketId },
        select: expect.objectContaining({
          id: true,
          requester_login_id: true,
          responser_login_id: true,
          description: true,
          area: { select: { id: true, alias: true } },
          login_requester: { select: { id: true, username: true } },
          login_responser: { select: { id: true, username: true } },
          _count: { select: { messages: true } },
        }),
      });
      expect(result).toBe(expected);
    });

    it('should return undefined when the row is absent', async () => {
      database.tickets.findFirst.mockResolvedValue(null);

      await expect(
        repository.findOne({ where: { id: ticketId } }),
      ).resolves.toBeUndefined();
    });

    it('should delegate errors to errorHandler', async () => {
      const error = new Error('prisma');
      database.tickets.findFirst.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.findOne({ where: { id: ticketId } });

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });

  describe('createOne', () => {
    const created_at = new Date('2026-08-20T12:00:00.000Z');

    it('should create the ticket with the area when one is given', async () => {
      const params: ITicketsCreateOneParams = {
        area_id: areaId,
        requester_login_id: loginId,
        subject: 'Printer is down',
        description: 'Third floor printer stopped responding',
        created_at,
      };
      database.tickets.create.mockResolvedValue({ id: ticketId });

      const result = await repository.createOne(params);

      expect(database.tickets.create).toHaveBeenCalledWith({
        data: {
          area_id: areaId,
          requester_login_id: loginId,
          subject: 'Printer is down',
          description: 'Third floor printer stopped responding',
          created_at,
        },
        select: { id: true },
      });
      expect(result).toEqual({ id: ticketId });
    });

    it('should omit area_id entirely when it is absent', async () => {
      database.tickets.create.mockResolvedValue({ id: ticketId });

      await repository.createOne({
        requester_login_id: loginId,
        subject: 'No area',
        description: 'Unassigned ticket',
        created_at,
      });

      const [call] = database.tickets.create.mock.calls;
      expect(call[0].data).not.toHaveProperty('area_id');
    });
  });

  describe('updateOneById', () => {
    it('should send only the fields that were provided', async () => {
      const params: ITicketsUpdateOneParams = {
        id: ticketId,
        state: 'IN_PROGRESS',
        responser_login_id: loginId,
      };
      database.tickets.update.mockResolvedValue({ id: ticketId });

      const result = await repository.updateOneById(params);

      expect(database.tickets.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { state: 'IN_PROGRESS', responser_login_id: loginId },
        select: { id: true },
      });
      expect(result).toEqual({ id: ticketId });
    });

    it('should return undefined when errorHandler swallows a missing row', async () => {
      const error = new Error('P2025');
      database.tickets.update.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.updateOneById({ id: ticketId });

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest libs/database/src/repositories/tickets/repository.spec.ts`
Expected: FAIL — `repository.findOne is not a function`.

- [ ] **Step 3: Add the constants and interfaces**

Append to `backend/libs/database/src/repositories/tickets/repository.interface.ts` (keep the existing `TICKET_RELATIONS` and `ITicketsFindManyWithPaginationParams` exactly as they are):

```ts
export const TICKET_PRIORITIES = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export const TICKET_STATES = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  ESCALATED: 'ESCALATED',
  WAITING_FEEDBACK: 'WAITING_FEEDBACK',
  RESOLVED: 'RESOLVED',
} as const;

export interface ITicketsFindOneParams<Args> {
  where: Args;
}

export interface ITicketsFindOnePromise {
  id: string;
  area_id: string | null;
  requester_login_id: string;
  responser_login_id: string | null;
  subject: string;
  description: string;
  priority: keyof typeof TICKET_PRIORITIES;
  state: keyof typeof TICKET_STATES;
  created_at: Date;
  updated_at: Date;
  area: { id: string; alias: string } | null;
  login_requester: { id: string; username: string };
  login_responser: { id: string; username: string } | null;
  _count: { messages: number };
}

export interface ITicketsCreateOneParams {
  area_id?: string;
  requester_login_id: string;
  subject: string;
  description: string;
  created_at: Date;
}

export interface ITicketsCreateOnePromise {
  id: string;
}

export interface ITicketsUpdateOneParams {
  id: string;
  area_id?: string;
  requester_login_id?: string;
  responser_login_id?: string;
  subject?: string;
  description?: string;
  priority?: keyof typeof TICKET_PRIORITIES;
  state?: keyof typeof TICKET_STATES;
}

export interface ITicketsUpdateOnePromise {
  id: string;
}
```

- [ ] **Step 4: Add the three methods**

In `backend/libs/database/src/repositories/tickets/repository.service.ts`, add the `Prisma` import and the new interface imports at the top:

```ts
import { Prisma } from '../../../prisma/generated/client';
import {
  ITicketsCreateOneParams,
  ITicketsCreateOnePromise,
  ITicketsFindManyWithPaginationParams,
  ITicketsFindOneParams,
  ITicketsFindOnePromise,
  ITicketsUpdateOneParams,
  ITicketsUpdateOnePromise,
} from './repository.interface';
```

Then add these three methods to the class, after `findManyWithPagination`:

```ts
  async findOne<Args>(
    params: ITicketsFindOneParams<Args>,
  ): Promise<ITicketsFindOnePromise | void> {
    const promise = await this.repository.tickets
      .findFirst({
        where: params.where as Prisma.ticketsWhereInput,
        select: {
          id: true,
          area_id: true,
          requester_login_id: true,
          responser_login_id: true,
          subject: true,
          description: true,
          priority: true,
          state: true,
          created_at: true,
          updated_at: true,
          area: { select: { id: true, alias: true } },
          login_requester: { select: { id: true, username: true } },
          login_responser: { select: { id: true, username: true } },
          _count: { select: { messages: true } },
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }

  async createOne(
    params: ITicketsCreateOneParams,
  ): Promise<ITicketsCreateOnePromise | void> {
    const { area_id, requester_login_id, subject, description, created_at } =
      params;

    const promise = await this.repository.tickets
      .create({
        data: {
          ...(area_id && { area_id }),
          requester_login_id,
          subject,
          description,
          created_at,
        },
        select: { id: true },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }

  async updateOneById(
    params: ITicketsUpdateOneParams,
  ): Promise<ITicketsUpdateOnePromise | void> {
    const {
      id,
      area_id,
      requester_login_id,
      responser_login_id,
      subject,
      description,
      priority,
      state,
    } = params;

    const promise = await this.repository.tickets
      .update({
        where: { id },
        data: {
          ...(area_id && { area_id }),
          ...(requester_login_id && { requester_login_id }),
          ...(responser_login_id && { responser_login_id }),
          ...(subject && { subject }),
          ...(description && { description }),
          ...(priority && { priority }),
          ...(state && { state }),
        },
        select: { id: true },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }
```

`updated_at` carries `@updatedAt`, so Prisma bumps it on every update and sets it on create — never pass it explicitly.

- [ ] **Step 5: Run the test and the type-check**

Run: `npx jest libs/database/src/repositories/tickets/repository.spec.ts`
Expected: PASS, 8 tests.

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'`
Expected: `18` — unchanged from baseline.

- [ ] **Step 6: Commit**

```bash
git add libs/database/src/repositories/tickets/
git commit -F - <<'MSG'
feat(database): Add ticket read, create and update repository methods

Adds findOne with the full detail select, createOne and updateOneById to
TicketsRepository, plus the TICKET_PRIORITIES and TICKET_STATES constants
the DTO layer validates against.
MSG
```

---

### Task 2: Message thread and area existence repository reads

**Files:**
- Modify: `backend/libs/database/src/repositories/ticket-messages/repository.interface.ts`
- Modify: `backend/libs/database/src/repositories/ticket-messages/repository.service.ts`
- Modify: `backend/libs/database/src/repositories/areas/repository.interface.ts`
- Modify: `backend/libs/database/src/repositories/areas/repository.service.ts`
- Test: `backend/libs/database/src/repositories/ticket-messages/repository.spec.ts` (**extend — this file already exists and its tests pass; append a `describe` block, never rewrite the file**)
- Test: `backend/libs/database/src/repositories/areas/repository.spec.ts` (**extend — same warning**)

**Interfaces:**
- Consumes: `DatabaseService`.
- Produces: `TicketMessagesRepository.findManyByTicketId(params: ITicketMessagesFindManyByTicketIdParams): Promise<ITicketMessageItemPromise[] | void>` and `AreasRepository.findOneById(id: string): Promise<IAreasFindOneByIdPromise | void>`.

- [ ] **Step 1: Write the failing test**

`backend/libs/database/src/repositories/ticket-messages/repository.spec.ts` **already exists and its tests pass.** Open it, read its existing `beforeEach`, and APPEND to it. Do not recreate the file and do not delete a single existing test.

Two edits to that file:

1. Add `findMany: jest.fn()` to the `ticket_messages` mock object if it is not already there, and add the matching `findMany: jest.Mock` to the `database` variable's type annotation. Leave every other mock key in place.
2. Add this `describe` block inside the existing top-level `describe('TicketMessagesRepository', ...)`, after the blocks already there. Reuse whatever fixture ids the file already defines; if it has no ticket id constant, add `const ticketId = '019538c4-2f7a-7c31-9c1b-000000000001';` alongside the existing ones.

```ts
  describe('findManyByTicketId', () => {
    it('should read the whole thread newest first', async () => {
      const expected = [{ id: 'a' }, { id: 'b' }];
      database.ticket_messages.findMany.mockResolvedValue(expected);

      const result = await repository.findManyByTicketId({
        ticket_id: ticketId,
      });

      expect(database.ticket_messages.findMany).toHaveBeenCalledWith({
        where: { ticket_id: ticketId },
        select: {
          id: true,
          message: true,
          created_at: true,
          login: { select: { id: true, username: true } },
        },
        orderBy: { created_at: 'desc' },
      });
      expect(result).toBe(expected);
    });

    it('should return the empty array unchanged when the thread is empty', async () => {
      database.ticket_messages.findMany.mockResolvedValue([]);

      await expect(
        repository.findManyByTicketId({ ticket_id: ticketId }),
      ).resolves.toEqual([]);
    });

    it('should delegate errors to errorHandler', async () => {
      const error = new Error('prisma');
      database.ticket_messages.findMany.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.findManyByTicketId({
        ticket_id: ticketId,
      });

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });
```

Note on the second test: an empty thread must come back as `[]`, not `undefined`. Guarding with `if (promise)` would turn `[]` falsy-adjacent handling into a bug — `[]` is truthy in JS, so `if (promise) return promise;` is correct here, and this test locks that in.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest libs/database/src/repositories/ticket-messages/repository.spec.ts`
Expected: FAIL — `repository.findManyByTicketId is not a function`.

- [ ] **Step 3: Implement `findManyByTicketId`**

Append to `backend/libs/database/src/repositories/ticket-messages/repository.interface.ts`:

```ts
export interface ITicketMessagesFindManyByTicketIdParams {
  ticket_id: string;
}

export interface ITicketMessageItemPromise {
  id: string;
  message: string;
  created_at: Date;
  login: {
    id: string;
    username: string;
  };
}
```

Add to `TicketMessagesRepository` in `backend/libs/database/src/repositories/ticket-messages/repository.service.ts` (extend the existing import from `./repository.interface` to include both new names):

```ts
  async findManyByTicketId(
    params: ITicketMessagesFindManyByTicketIdParams,
  ): Promise<ITicketMessageItemPromise[] | void> {
    const { ticket_id } = params;

    const promise = await this.repository.ticket_messages
      .findMany({
        where: { ticket_id },
        select: {
          id: true,
          message: true,
          created_at: true,
          login: { select: { id: true, username: true } },
        },
        orderBy: { created_at: 'desc' },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }
```

- [ ] **Step 4: Implement `AreasRepository.findOneById`**

Append to `backend/libs/database/src/repositories/areas/repository.interface.ts`:

```ts
export interface IAreasFindOneByIdPromise {
  id: string;
}
```

Add to `AreasRepository` in `backend/libs/database/src/repositories/areas/repository.service.ts`, after `findAccountsById` (extend the existing interface import to include `IAreasFindOneByIdPromise`):

```ts
  async findOneById(id: string): Promise<IAreasFindOneByIdPromise | void> {
    const promise = await this.repository.areas
      .findUnique({
        where: { id },
        select: { id: true },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }
```

`backend/libs/database/src/repositories/areas/repository.spec.ts` **already exists and its tests pass.** Append this `describe` block inside its existing top-level `describe`, and add `findUnique: jest.fn()` to its `areas` mock (plus the matching type annotation entry) if it is not already there. Reuse the file's existing area id constant; the name below assumes `areaId`, so rename to match whatever the file already declares.

```ts
  describe('findOneById', () => {
    it('should select only the id', async () => {
      database.areas.findUnique.mockResolvedValue({ id: areaId });

      const result = await repository.findOneById(areaId);

      expect(database.areas.findUnique).toHaveBeenCalledWith({
        where: { id: areaId },
        select: { id: true },
      });
      expect(result).toEqual({ id: areaId });
    });

    it('should return undefined for an unknown area', async () => {
      database.areas.findUnique.mockResolvedValue(null);

      await expect(repository.findOneById(areaId)).resolves.toBeUndefined();
    });

    it('should delegate errors to errorHandler', async () => {
      const error = new Error('prisma');
      database.areas.findUnique.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.findOneById(areaId);

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });
```

- [ ] **Step 5: Run the tests and the type-check**

Run: `npx jest libs/database/src/repositories/`
Expected: PASS on every suite — the ticket-messages suite grows by 3 tests, the areas suite by 3, and Task 1's tickets suite plus the logins suite stay green. No suite loses a test.

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'`
Expected: `18`.

- [ ] **Step 6: Commit**

```bash
git add libs/database/src/repositories/ticket-messages/ libs/database/src/repositories/areas/
git commit -F - <<'MSG'
feat(database): Read a ticket message thread and check area existence

Adds TicketMessagesRepository.findManyByTicketId, which returns the whole
thread newest first with no pagination, and AreasRepository.findOneById,
which the tickets domain uses to reject an unknown area_id before writing.
MSG
```

---

### Task 3: `@app/tickets` library and the scoped list

**Files:**
- Create: `backend/libs/tickets/src/tickets.interface.ts`
- Create: `backend/libs/tickets/src/tickets.service.ts`
- Create: `backend/libs/tickets/src/tickets.module.ts`
- Create: `backend/libs/tickets/src/index.ts`
- Create: `backend/libs/tickets/tsconfig.lib.json`
- Modify: `backend/tsconfig.json` (paths)
- Modify: `backend/package.json` (jest `moduleNameMapper`)
- Modify: `backend/nest-cli.json` (projects)
- Test: `backend/libs/tickets/src/tickets.service.spec.ts` (create)

**Interfaces:**
- Consumes: `TicketsRepository.findManyWithPagination` (unchanged), `parseSort` from `utils/parse-sort`, `LOGIN_ROLES` from `@app/database`, `CACHE_TTL` from `configuration/constants`.
- Produces: `TicketsService`, `TicketsModule`, and every interface in `tickets.interface.ts`. Tasks 4 and 5 add methods to the same `TicketsService` class; Tasks 6 and 7 import the interfaces from `@app/tickets`.

This task creates the whole interface file up front — Tasks 4 and 5 fill in the methods that use the rest of it, so nothing is left dangling.

- [ ] **Step 1: Register the library in the toolchain**

`backend/tsconfig.json` — add to `compilerOptions.paths`, keeping alphabetical order (after the `@app/database` entries):

```json
      "@app/tickets": ["libs/tickets/src"],
      "@app/tickets/*": ["libs/tickets/src/*"]
```

`backend/package.json` — add to `jest.moduleNameMapper`, after the `@app/database` entry:

```json
      "^@app/tickets(|/.*)$": "<rootDir>/libs/tickets/src/$1"
```

`backend/nest-cli.json` — add to `projects`, after the `database` entry:

```json
    "tickets": {
      "type": "library",
      "root": "libs/tickets",
      "entryFile": "index",
      "sourceRoot": "libs/tickets/src",
      "compilerOptions": {
        "tsConfigPath": "libs/tickets/tsconfig.lib.json"
      }
    }
```

Create `backend/libs/tickets/tsconfig.lib.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../dist/libs/tickets"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

- [ ] **Step 2: Write the interface file**

Create `backend/libs/tickets/src/tickets.interface.ts`:

```ts
import { LOGIN_ROLES } from '@app/database';
import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';
import {
  TICKET_PRIORITY,
  TICKET_STATE,
} from '../../database/prisma/generated/enums';

export interface ITicketScopedAccount {
  id: string;
  role?: keyof typeof LOGIN_ROLES;
}

export interface ITicketFindManyParams {
  account: ITicketScopedAccount;
  offset?: number;
  per_page: number;
  sort: string;
  state?: TICKET_STATE[];
  priority?: TICKET_PRIORITY[];
  area_id?: string;
  requester_login_id?: string;
  responser_login_id?: string;
}

export interface ITicketItemListPromise {
  id: string;
  subject: string;
  priority: TICKET_PRIORITY;
  state: TICKET_STATE;
  created_at: Date;
  updated_at: Date;
  area: {
    id: string;
    alias: string;
  } | null;
  login_requester: {
    username: string;
  };
  login_responser: {
    username: string;
  } | null;
  _count: {
    messages: number;
  };
}

export interface ITicketListWithPaginationPromise extends TPaginationData {
  data: ITicketItemListPromise[];
}

export interface ITicketFindOneParams {
  ticket_id: string;
  account: ITicketScopedAccount;
}

export interface ITicketDetailPromise {
  id: string;
  area_id: string | null;
  requester_login_id: string;
  responser_login_id: string | null;
  subject: string;
  description: string;
  priority: TICKET_PRIORITY;
  state: TICKET_STATE;
  created_at: Date;
  updated_at: Date;
  area: {
    id: string;
    alias: string;
  } | null;
  login_requester: {
    id: string;
    username: string;
  };
  login_responser: {
    id: string;
    username: string;
  } | null;
  _count: {
    messages: number;
  };
}

export interface ITicketFindMessagesParams {
  ticket_id: string;
  account: ITicketScopedAccount;
}

export interface ITicketMessageItemListPromise {
  id: string;
  message: string;
  created_at: Date;
  login: {
    id: string;
    username: string;
  };
}

export interface ITicketCreateParams {
  requester_login_id: string;
  subject: string;
  description: string;
  area_id?: string;
}

export interface ITicketCreatePromise {
  id: string;
}

export interface ITicketUpdateParams {
  id: string;
  area_id?: string;
  requester_login_id?: string;
  responser_login_id?: string;
  subject?: string;
  description?: string;
  priority?: TICKET_PRIORITY;
  state?: TICKET_STATE;
}

export interface ITicketUpdatePromise {
  id: string;
}
```

`ITicketScopedAccount` deliberately does NOT import `IAuthenticatedAccount` from `@app/auth`. The domain has no business knowing about JWTs, and `IAuthenticatedAccount` is structurally assignable to it, so the controller passes its account straight through.

- [ ] **Step 3: Write the failing test**

Create `backend/libs/tickets/src/tickets.service.spec.ts`:

```ts
import { CacheModuleServices } from '@app/cache';
import {
  AreasRepository,
  LoginsRepository,
  TicketMessagesRepository,
  TicketsRepository,
} from '@app/database';
import { UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ITicketScopedAccount } from './tickets.interface';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let cache: jest.Mocked<CacheModuleServices>;
  let repository: jest.Mocked<TicketsRepository>;
  let ticketMessagesRepository: jest.Mocked<TicketMessagesRepository>;
  let loginsRepository: jest.Mocked<LoginsRepository>;
  let areasRepository: jest.Mocked<AreasRepository>;

  const ticket_id = '019538c4-2f7a-7c31-9c1b-000000000001';
  const area_id = '019538c4-2f7a-7c31-9c1b-000000000002';
  const other_login_id = '019538c4-2f7a-7c31-9c1b-000000000004';

  const user: ITicketScopedAccount = {
    id: '019538c4-2f7a-7c31-9c1b-000000000003',
    role: 'USER',
  };
  const admin: ITicketScopedAccount = {
    id: '019538c4-2f7a-7c31-9c1b-000000000005',
    role: 'ADMIN',
  };

  const pagination = { data: [], meta: { count: 0 } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: CacheModuleServices,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: TicketsRepository,
          useValue: {
            findManyWithPagination: jest.fn(),
            findOne: jest.fn(),
            createOne: jest.fn(),
            updateOneById: jest.fn(),
          },
        },
        {
          provide: TicketMessagesRepository,
          useValue: { findManyByTicketId: jest.fn() },
        },
        {
          provide: LoginsRepository,
          useValue: { findManyRolesByIds: jest.fn() },
        },
        {
          provide: AreasRepository,
          useValue: { findOneById: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(TicketsService);
    cache = module.get(CacheModuleServices);
    repository = module.get(TicketsRepository);
    ticketMessagesRepository = module.get(TicketMessagesRepository);
    loginsRepository = module.get(LoginsRepository);
    areasRepository = module.get(AreasRepository);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findManyWithPagination', () => {
    it('should pin a USER to their own requester_login_id', async () => {
      repository.findManyWithPagination.mockResolvedValue(pagination as never);

      await service.findManyWithPagination({
        account: user,
        per_page: 10,
        sort: '-created_at',
      });

      const [call] = repository.findManyWithPagination.mock.calls;
      expect(call[0].where).toEqual({ requester_login_id: user.id });
      expect(call[0].sort).toEqual({
        column: 'created_at',
        direction: 'desc',
      });
    });

    it('should drop the login filters a USER sends', async () => {
      repository.findManyWithPagination.mockResolvedValue(pagination as never);

      await service.findManyWithPagination({
        account: user,
        per_page: 10,
        sort: 'created_at',
        requester_login_id: other_login_id,
        responser_login_id: other_login_id,
      });

      const [call] = repository.findManyWithPagination.mock.calls;
      expect(call[0].where).toEqual({ requester_login_id: user.id });
    });

    it('should leave an ADMIN unscoped and honour their login filters', async () => {
      repository.findManyWithPagination.mockResolvedValue(pagination as never);

      await service.findManyWithPagination({
        account: admin,
        per_page: 10,
        sort: 'created_at',
        responser_login_id: other_login_id,
      });

      const [call] = repository.findManyWithPagination.mock.calls;
      expect(call[0].where).toEqual({
        responser_login_id: other_login_id,
      });
    });

    it('should apply the state, priority and area filters', async () => {
      repository.findManyWithPagination.mockResolvedValue(pagination as never);

      await service.findManyWithPagination({
        account: admin,
        per_page: 10,
        sort: 'created_at',
        state: ['NEW', 'IN_PROGRESS'],
        priority: ['URGENT'],
        area_id,
      });

      const [call] = repository.findManyWithPagination.mock.calls;
      expect(call[0].where).toEqual({
        state: { in: ['NEW', 'IN_PROGRESS'] },
        priority: { in: ['URGENT'] },
        area_id,
      });
    });

    it('should select the message count alongside the row', async () => {
      repository.findManyWithPagination.mockResolvedValue(pagination as never);

      await service.findManyWithPagination({
        account: admin,
        per_page: 10,
        sort: 'created_at',
      });

      const [call] = repository.findManyWithPagination.mock.calls;
      expect(call[0].select).toEqual(
        expect.objectContaining({
          _count: { select: { messages: true } },
          login_requester: { select: { username: true } },
          login_responser: { select: { username: true } },
        }),
      );
    });

    it('should raise 422 when the repository yields nothing', async () => {
      repository.findManyWithPagination.mockResolvedValue(undefined);

      await expect(
        service.findManyWithPagination({
          account: admin,
          per_page: 10,
          sort: 'created_at',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
```

The unused mock handles (`cache`, `ticketMessagesRepository`, `loginsRepository`, `areasRepository`) are wired now because Tasks 4 and 5 append `describe` blocks to this same file.

- [ ] **Step 4: Run test to verify it fails**

Run: `npx jest libs/tickets/`
Expected: FAIL — cannot resolve `./tickets.service`.

- [ ] **Step 5: Write the service, module and barrel**

Create `backend/libs/tickets/src/tickets.service.ts`:

```ts
import { CacheModuleServices } from '@app/cache';
import {
  AreasRepository,
  LOGIN_ROLES,
  LoginsRepository,
  TicketMessagesRepository,
  TicketsRepository,
} from '@app/database';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { parseSort } from '../../../utils/parse-sort';
import { Prisma } from '../../database/prisma/generated/client';
import {
  ITicketFindManyParams,
  ITicketListWithPaginationPromise,
  ITicketScopedAccount,
} from './tickets.interface';

@Injectable()
export class TicketsService {
  private readonly privilegedRoles: string[] = [
    LOGIN_ROLES.ADMIN,
    LOGIN_ROLES.MASTER,
  ];

  constructor(
    private readonly cache: CacheModuleServices,
    private readonly repository: TicketsRepository,
    private readonly ticketMessagesRepository: TicketMessagesRepository,
    private readonly loginsRepository: LoginsRepository,
    private readonly areasRepository: AreasRepository,
  ) {}

  async findManyWithPagination(
    params: ITicketFindManyParams,
  ): Promise<ITicketListWithPaginationPromise> {
    const { per_page, offset } = params;
    const sort = parseSort(params.sort);

    const repositoryResult =
      await this.repository.findManyWithPagination<Prisma.ticketsWhereInput>({
        offset,
        per_page,
        sort,
        where: this.buildScopedWhere(params),
        select: {
          id: true,
          subject: true,
          priority: true,
          state: true,
          created_at: true,
          updated_at: true,
          area: { select: { id: true, alias: true } },
          login_requester: { select: { username: true } },
          login_responser: { select: { username: true } },
          _count: { select: { messages: true } },
        },
      });

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    return repositoryResult;
  }

  private isPrivileged(account: ITicketScopedAccount): boolean {
    return !!account.role && this.privilegedRoles.includes(account.role);
  }

  private buildScopedWhere(
    params: ITicketFindManyParams,
  ): Prisma.ticketsWhereInput {
    const {
      account,
      state,
      priority,
      area_id,
      requester_login_id,
      responser_login_id,
    } = params;

    const filters: Prisma.ticketsWhereInput = {
      ...(state && state.length > 0 && { state: { in: state } }),
      ...(priority && priority.length > 0 && { priority: { in: priority } }),
      ...(area_id && { area_id }),
    };

    if (!this.isPrivileged(account))
      return { ...filters, requester_login_id: account.id };

    return {
      ...filters,
      ...(requester_login_id && { requester_login_id }),
      ...(responser_login_id && { responser_login_id }),
    };
  }
}
```

`privilegedRoles` serves two rules at once: who reads unscoped (here) and who may be assigned as a responser (Task 5). They are the same set, ADMIN and MASTER, so one field holds it.

Create `backend/libs/tickets/src/tickets.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';

@Module({
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
```

Create `backend/libs/tickets/src/index.ts`:

```ts
export * from './tickets.module';
export * from './tickets.service';
export * from './tickets.interface';
```

- [ ] **Step 6: Run the test and the type-check**

Run: `npx jest libs/tickets/`
Expected: PASS, 7 tests.

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'`
Expected: `18`.

- [ ] **Step 7: Commit**

```bash
git add libs/tickets/ tsconfig.json package.json nest-cli.json
git commit -F - <<'MSG'
feat(tickets): Add the tickets library and the role-scoped list

Registers @app/tickets across tsconfig, jest and nest-cli, and adds
TicketsService.findManyWithPagination. A USER is pinned to their own
requester_login_id and their login filters are dropped; ADMIN and MASTER
read unscoped and may filter by requester or responser.
MSG
```

---

### Task 4: Cached detail and cached message thread

**Files:**
- Modify: `backend/libs/tickets/src/tickets.service.ts`
- Test: `backend/libs/tickets/src/tickets.service.spec.ts` (append)

**Interfaces:**
- Consumes: `TicketsRepository.findOne` (Task 1), `TicketMessagesRepository.findManyByTicketId` (Task 2), `CacheModuleServices.get`/`set`.
- Produces: `TicketsService.findOneById(params: ITicketFindOneParams): Promise<ITicketDetailPromise>` and `TicketsService.findMessagesByTicketId(params: ITicketFindMessagesParams): Promise<ITicketMessageItemListPromise[]>`.

**Design rule this task implements (spec §3.1):** the row is fetched *unscoped*, cached, and only then authorized in memory. This keeps one cache entry per ticket rather than one per account, and makes the cache-hit path and the cache-miss path run the identical check.

- [ ] **Step 1: Write the failing test**

Append these two `describe` blocks inside the existing top-level `describe('TicketsService', ...)` in `backend/libs/tickets/src/tickets.service.spec.ts`, after the `findManyWithPagination` block:

```ts
  describe('findOneById', () => {
    const detail = {
      id: ticket_id,
      requester_login_id: user.id,
      subject: 'Printer is down',
    };

    it('should serve a cache hit without touching the repository', async () => {
      cache.get.mockResolvedValue(detail as never);

      const result = await service.findOneById({ ticket_id, account: user });

      expect(result).toBe(detail);
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('should read unscoped, cache, then return on a miss', async () => {
      cache.get.mockResolvedValue(undefined);
      repository.findOne.mockResolvedValue(detail as never);

      const result = await service.findOneById({ ticket_id, account: user });

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: ticket_id },
      });
      expect(cache.set).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'tickets:detail',
          item: ticket_id,
          data: detail,
        }),
      );
      expect(result).toBe(detail);
    });

    it('should 404 a USER reading another account ticket from cache', async () => {
      cache.get.mockResolvedValue({
        ...detail,
        requester_login_id: other_login_id,
      } as never);

      await expect(
        service.findOneById({ ticket_id, account: user }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should 404 a USER reading another account ticket from the repository', async () => {
      cache.get.mockResolvedValue(undefined);
      repository.findOne.mockResolvedValue({
        ...detail,
        requester_login_id: other_login_id,
      } as never);

      await expect(
        service.findOneById({ ticket_id, account: user }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should let an ADMIN read a ticket they do not own', async () => {
      cache.get.mockResolvedValue({
        ...detail,
        requester_login_id: other_login_id,
      } as never);

      await expect(
        service.findOneById({ ticket_id, account: admin }),
      ).resolves.toBeDefined();
    });

    it('should 404 when the ticket does not exist', async () => {
      cache.get.mockResolvedValue(undefined);
      repository.findOne.mockResolvedValue(undefined);

      await expect(
        service.findOneById({ ticket_id, account: admin }),
      ).rejects.toThrow(NotFoundException);
      expect(cache.set).not.toHaveBeenCalled();
    });
  });

  describe('findMessagesByTicketId', () => {
    const detail = {
      id: ticket_id,
      requester_login_id: user.id,
    };
    const thread = [{ id: 'm1', message: 'hello' }];

    it('should authorize through the ticket before reading the thread', async () => {
      cache.get.mockResolvedValueOnce({
        ...detail,
        requester_login_id: other_login_id,
      } as never);

      await expect(
        service.findMessagesByTicketId({ ticket_id, account: user }),
      ).rejects.toThrow(NotFoundException);
      expect(
        ticketMessagesRepository.findManyByTicketId,
      ).not.toHaveBeenCalled();
    });

    it('should serve the thread from cache on a hit', async () => {
      cache.get
        .mockResolvedValueOnce(detail as never)
        .mockResolvedValueOnce(thread as never);

      const result = await service.findMessagesByTicketId({
        ticket_id,
        account: user,
      });

      expect(result).toBe(thread);
      expect(
        ticketMessagesRepository.findManyByTicketId,
      ).not.toHaveBeenCalled();
    });

    it('should read and cache the thread on a miss', async () => {
      cache.get
        .mockResolvedValueOnce(detail as never)
        .mockResolvedValueOnce(undefined);
      ticketMessagesRepository.findManyByTicketId.mockResolvedValue(
        thread as never,
      );

      const result = await service.findMessagesByTicketId({
        ticket_id,
        account: user,
      });

      expect(
        ticketMessagesRepository.findManyByTicketId,
      ).toHaveBeenCalledWith({ ticket_id });
      expect(cache.set).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'tickets:messages',
          item: ticket_id,
          data: thread,
        }),
      );
      expect(result).toBe(thread);
    });
  });
```

Add `NotFoundException` to the existing `@nestjs/common` import at the top of the spec.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest libs/tickets/`
Expected: FAIL — `service.findOneById is not a function`.

- [ ] **Step 3: Implement both methods**

Extend the imports at the top of `backend/libs/tickets/src/tickets.service.ts`:

```ts
import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CACHE_TTL } from '../../../configuration/constants';
```

and add to the `./tickets.interface` import: `ITicketDetailPromise`, `ITicketFindMessagesParams`, `ITicketFindOneParams`, `ITicketMessageItemListPromise`.

Add these methods to the class, after `findManyWithPagination`:

```ts
  async findOneById(
    params: ITicketFindOneParams,
  ): Promise<ITicketDetailPromise> {
    const { ticket_id, account } = params;

    const cacheKey = 'tickets:detail';
    const cache = await this.cache.get<ITicketDetailPromise>({
      key: cacheKey,
      item: ticket_id,
    });

    if (cache) return this.authorizeTicket(cache, account);

    const repositoryResult =
      await this.repository.findOne<Prisma.ticketsWhereInput>({
        where: { id: ticket_id },
      });

    if (!repositoryResult) throw new NotFoundException('ticket_not_found');

    await this.cache.set({
      key: cacheKey,
      item: ticket_id,
      data: repositoryResult,
      ttl: CACHE_TTL.ten,
    });

    return this.authorizeTicket(repositoryResult, account);
  }

  async findMessagesByTicketId(
    params: ITicketFindMessagesParams,
  ): Promise<ITicketMessageItemListPromise[]> {
    const { ticket_id, account } = params;

    await this.findOneById({ ticket_id, account });

    const cacheKey = 'tickets:messages';
    const cache = await this.cache.get<ITicketMessageItemListPromise[]>({
      key: cacheKey,
      item: ticket_id,
    });

    if (cache) return cache;

    const repositoryResult =
      await this.ticketMessagesRepository.findManyByTicketId({ ticket_id });

    if (!repositoryResult) return [];

    await this.cache.set({
      key: cacheKey,
      item: ticket_id,
      data: repositoryResult,
      ttl: CACHE_TTL.ten,
    });

    return repositoryResult;
  }

  private authorizeTicket(
    ticket: ITicketDetailPromise,
    account: ITicketScopedAccount,
  ): ITicketDetailPromise {
    if (this.isPrivileged(account)) return ticket;

    if (ticket.requester_login_id !== account.id)
      throw new NotFoundException('ticket_not_found');

    return ticket;
  }
```

`findOne` returns `ITicketsFindOnePromise` from the repository while this method declares `ITicketDetailPromise`. The two are structurally identical by design — the repository interface names the enum columns via `keyof typeof TICKET_PRIORITIES`, the domain interface via the generated `TICKET_PRIORITY` type, and both resolve to the same string union.

**Known and accepted:** a cached detail round-trips through `JSON.stringify`, so `created_at` and `updated_at` come back as ISO strings on a cache hit and as `Date` objects on a miss. The HTTP response serializes both identically, and no in-process consumer reads those fields, so this is not worth a transform pass. Do not "fix" it.

- [ ] **Step 4: Run the test and the type-check**

Run: `npx jest libs/tickets/`
Expected: PASS, 16 tests.

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'`
Expected: `18`.

- [ ] **Step 5: Commit**

```bash
git add libs/tickets/
git commit -F - <<'MSG'
feat(tickets): Cache the ticket detail and its message thread

findOneById reads the row unscoped, caches it, then authorizes in memory
against requester_login_id, so one cache entry serves every caller who may
see it and the hit and miss paths apply the same check. A USER asking for
another account ticket gets 404, never 403. findMessagesByTicketId
authorizes through the ticket before it reads the thread.
MSG
```

---

### Task 5: Create, update, validation and cache invalidation

**Files:**
- Modify: `backend/libs/tickets/src/tickets.service.ts`
- Test: `backend/libs/tickets/src/tickets.service.spec.ts` (append)

**Interfaces:**
- Consumes: `TicketsRepository.createOne`/`updateOneById` (Task 1), `AreasRepository.findOneById` (Task 2), `LoginsRepository.findManyRolesByIds` (already on `main`), `CacheModuleServices.delete`.
- Produces: `TicketsService.createOne(params: ITicketCreateParams): Promise<ITicketCreatePromise>` and `TicketsService.updateOneById(params: ITicketUpdateParams): Promise<ITicketUpdatePromise>`.

**Why validation is explicit (spec §6.1):** `DatabaseService.errorHandler` swallows every known Prisma code except `P2002`, returning `void`. A foreign-key violation would therefore surface as `404 ticket_not_found`, which is the wrong answer to "that area does not exist". Validate every referenced id with a read before writing.

- [ ] **Step 1: Write the failing test**

Append these two `describe` blocks to `backend/libs/tickets/src/tickets.service.spec.ts`:

```ts
  describe('createOne', () => {
    const body = {
      requester_login_id: user.id,
      subject: 'Printer is down',
      description: 'Third floor printer stopped responding',
    };

    it('should create without an area and skip the area check', async () => {
      repository.createOne.mockResolvedValue({ id: ticket_id });

      const result = await service.createOne(body);

      expect(areasRepository.findOneById).not.toHaveBeenCalled();
      expect(repository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({
          requester_login_id: user.id,
          subject: body.subject,
          description: body.description,
          created_at: expect.any(Date),
        }),
      );
      expect(result).toEqual({ id: ticket_id });
    });

    it('should validate the area when one is given', async () => {
      areasRepository.findOneById.mockResolvedValue({ id: area_id });
      repository.createOne.mockResolvedValue({ id: ticket_id });

      await service.createOne({ ...body, area_id });

      expect(areasRepository.findOneById).toHaveBeenCalledWith(area_id);
    });

    it('should raise 422 invalid_ticket_area for an unknown area', async () => {
      areasRepository.findOneById.mockResolvedValue(undefined);

      await expect(service.createOne({ ...body, area_id })).rejects.toThrow(
        'invalid_ticket_area',
      );
      expect(repository.createOne).not.toHaveBeenCalled();
    });

    it('should never invalidate cache on create', async () => {
      repository.createOne.mockResolvedValue({ id: ticket_id });

      await service.createOne(body);

      expect(cache.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateOneById', () => {
    it('should drop both cache entries for the ticket after writing', async () => {
      repository.updateOneById.mockResolvedValue({ id: ticket_id });

      await service.updateOneById({ id: ticket_id, subject: 'New subject' });

      expect(cache.delete).toHaveBeenCalledWith([
        `tickets:detail:${ticket_id}`,
        `tickets:messages:${ticket_id}`,
      ]);
    });

    it('should accept an ADMIN responser', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([
        { id: other_login_id, role: 'ADMIN' },
      ]);
      repository.updateOneById.mockResolvedValue({ id: ticket_id });

      await service.updateOneById({
        id: ticket_id,
        responser_login_id: other_login_id,
      });

      expect(loginsRepository.findManyRolesByIds).toHaveBeenCalledWith([
        other_login_id,
      ]);
      expect(repository.updateOneById).toHaveBeenCalled();
    });

    it('should reject a USER responser with 422 invalid_ticket_responser', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([
        { id: other_login_id, role: 'USER' },
      ]);

      await expect(
        service.updateOneById({
          id: ticket_id,
          responser_login_id: other_login_id,
        }),
      ).rejects.toThrow('invalid_ticket_responser');
      expect(repository.updateOneById).not.toHaveBeenCalled();
    });

    it('should reject an unknown responser', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([]);

      await expect(
        service.updateOneById({
          id: ticket_id,
          responser_login_id: other_login_id,
        }),
      ).rejects.toThrow('invalid_ticket_responser');
    });

    it('should accept a USER requester', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([
        { id: other_login_id, role: 'USER' },
      ]);
      repository.updateOneById.mockResolvedValue({ id: ticket_id });

      await service.updateOneById({
        id: ticket_id,
        requester_login_id: other_login_id,
      });

      expect(repository.updateOneById).toHaveBeenCalled();
    });

    it('should reject an unknown requester with 422 invalid_ticket_requester', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue([]);

      await expect(
        service.updateOneById({
          id: ticket_id,
          requester_login_id: other_login_id,
        }),
      ).rejects.toThrow('invalid_ticket_requester');
    });

    it('should 404 when the ticket does not exist and skip invalidation', async () => {
      repository.updateOneById.mockResolvedValue(undefined);

      await expect(
        service.updateOneById({ id: ticket_id, state: 'RESOLVED' }),
      ).rejects.toThrow(NotFoundException);
      expect(cache.delete).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest libs/tickets/`
Expected: FAIL — `service.createOne is not a function`.

- [ ] **Step 3: Implement create, update and the validators**

Add `ITicketCreateParams`, `ITicketCreatePromise`, `ITicketUpdateParams`, `ITicketUpdatePromise` to the `./tickets.interface` import, then add to the class:

```ts
  async createOne(params: ITicketCreateParams): Promise<ITicketCreatePromise> {
    const { requester_login_id, subject, description, area_id } = params;

    if (area_id) await this.validateArea(area_id);

    const repositoryResult = await this.repository.createOne({
      requester_login_id,
      subject,
      description,
      ...(area_id && { area_id }),
      created_at: new Date(),
    });

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    return repositoryResult;
  }

  async updateOneById(
    params: ITicketUpdateParams,
  ): Promise<ITicketUpdatePromise> {
    const { id, area_id, requester_login_id, responser_login_id } = params;

    if (area_id) await this.validateArea(area_id);
    if (requester_login_id) await this.validateRequester(requester_login_id);
    if (responser_login_id) await this.validateResponser(responser_login_id);

    const repositoryResult = await this.repository.updateOneById(params);

    if (!repositoryResult) throw new NotFoundException('ticket_not_found');

    await this.invalidateTicketCache(id);

    return repositoryResult;
  }

  private async validateArea(area_id: string): Promise<void> {
    const repositoryResult = await this.areasRepository.findOneById(area_id);

    if (!repositoryResult)
      throw new UnprocessableEntityException('invalid_ticket_area');
  }

  private async validateRequester(login_id: string): Promise<void> {
    const repositoryResult = await this.loginsRepository.findManyRolesByIds([
      login_id,
    ]);

    if (!repositoryResult || repositoryResult.length !== 1)
      throw new UnprocessableEntityException('invalid_ticket_requester');
  }

  private async validateResponser(login_id: string): Promise<void> {
    const repositoryResult = await this.loginsRepository.findManyRolesByIds([
      login_id,
    ]);

    if (!repositoryResult || repositoryResult.length !== 1)
      throw new UnprocessableEntityException('invalid_ticket_responser');

    if (!this.privilegedRoles.includes(repositoryResult[0].role))
      throw new UnprocessableEntityException('invalid_ticket_responser');
  }

  private async invalidateTicketCache(ticket_id: string): Promise<void> {
    await this.cache.delete([
      `tickets:detail:${ticket_id}`,
      `tickets:messages:${ticket_id}`,
    ]);
  }
```

`cache.delete` with the two exact keys, never `deleteCollection` — `deleteCollection` runs `SCAN` across the whole keyspace, and both keys are known exactly. `CacheModuleServices` joins key and item with `:`, which is why the literals here are `tickets:detail:<id>` and `tickets:messages:<id>`.

- [ ] **Step 4: Run the test and the type-check**

Run: `npx jest libs/tickets/`
Expected: PASS, 27 tests.

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'`
Expected: `18`.

- [ ] **Step 5: Commit**

```bash
git add libs/tickets/
git commit -F - <<'MSG'
feat(tickets): Create and update tickets with explicit reference checks

Every referenced id is read before the write, because errorHandler swallows
foreign-key errors and a missing area would otherwise surface as a 404 on
the ticket. A responser must be ADMIN or MASTER; a requester may hold any
role. An update drops the detail and message cache entries by exact key.
MSG
```

---

### Task 6: Controller DTOs

**Files:**
- Create: `backend/src/controllers/tickets/tickets.dto.ts`
- Test: `backend/src/controllers/tickets/tickets.dto.spec.ts` (create)

**Interfaces:**
- Consumes: `ITicketCreatePromise`, `ITicketUpdatePromise` from `@app/tickets`; `TICKET_PRIORITIES`, `TICKET_STATES` from `@app/database` (Task 1); `PAGINATION_OPTIONS` from `configuration/constants`.
- Produces: `ITicketIdParamDTO`, `ITicketsListQueryDTO`, `ITicketCreateDTO`, `ITicketUpdateDTO`, `ITicketCreateResponseDTO`, `ITicketUpdateResponseDTO`.

The global pipe is `ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })`, so an unknown property is a 400 and never reaches the handler.

- [ ] **Step 1: Write the failing test**

Create `backend/src/controllers/tickets/tickets.dto.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ITicketCreateDTO,
  ITicketIdParamDTO,
  ITicketsListQueryDTO,
  ITicketUpdateDTO,
} from './tickets.dto';

const ticketId = '019538c4-2f7a-7c31-9c1b-000000000001';

const check = async <T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<string[]> => {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance as object);
  return errors.map((error) => error.property);
};

describe('tickets DTOs', () => {
  describe('ITicketIdParamDTO', () => {
    it('should accept a version 7 uuid', async () => {
      await expect(check(ITicketIdParamDTO, { id: ticketId })).resolves.toEqual(
        [],
      );
    });

    it('should reject a zero-filled placeholder', async () => {
      await expect(
        check(ITicketIdParamDTO, {
          id: '00000000-0000-0000-0000-000000000001',
        }),
      ).resolves.toEqual(['id']);
    });
  });

  describe('ITicketsListQueryDTO', () => {
    it('should accept the minimum query', async () => {
      await expect(
        check(ITicketsListQueryDTO, { per_page: 10, sort: '-created_at' }),
      ).resolves.toEqual([]);
    });

    it('should normalise a single state into an array', async () => {
      const instance = plainToInstance(ITicketsListQueryDTO, {
        per_page: 10,
        sort: 'created_at',
        state: 'NEW',
      });

      expect(instance.state).toEqual(['NEW']);
      await expect(validate(instance)).resolves.toEqual([]);
    });

    it('should reject an unknown state', async () => {
      await expect(
        check(ITicketsListQueryDTO, {
          per_page: 10,
          sort: 'created_at',
          state: ['ARCHIVED'],
        }),
      ).resolves.toEqual(['state']);
    });

    it('should reject a per_page outside the allowed set', async () => {
      await expect(
        check(ITicketsListQueryDTO, { per_page: 7, sort: 'created_at' }),
      ).resolves.toEqual(['per_page']);
    });

    it('should reject an unknown sort column', async () => {
      await expect(
        check(ITicketsListQueryDTO, { per_page: 10, sort: 'description' }),
      ).resolves.toEqual(['sort']);
    });
  });

  describe('ITicketCreateDTO', () => {
    it('should accept subject and description without an area', async () => {
      await expect(
        check(ITicketCreateDTO, {
          subject: 'Printer is down',
          description: 'Third floor printer stopped responding',
        }),
      ).resolves.toEqual([]);
    });

    it('should reject a subject longer than the column', async () => {
      await expect(
        check(ITicketCreateDTO, {
          subject: 'x'.repeat(201),
          description: 'body',
        }),
      ).resolves.toEqual(['subject']);
    });

    it('should reject a missing description', async () => {
      await expect(
        check(ITicketCreateDTO, { subject: 'Printer is down' }),
      ).resolves.toEqual(['description']);
    });
  });

  describe('ITicketUpdateDTO', () => {
    it('should accept an empty object at the DTO layer', async () => {
      await expect(check(ITicketUpdateDTO, {})).resolves.toEqual([]);
    });

    it('should accept a state and a priority', async () => {
      await expect(
        check(ITicketUpdateDTO, { state: 'RESOLVED', priority: 'URGENT' }),
      ).resolves.toEqual([]);
    });

    it('should reject an unknown priority', async () => {
      await expect(
        check(ITicketUpdateDTO, { priority: 'BLOCKER' }),
      ).resolves.toEqual(['priority']);
    });
  });
});
```

The "empty object is accepted" test is deliberate: rejecting an empty update body is the controller service's job in Task 7, not the DTO's.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/controllers/tickets/tickets.dto.spec.ts`
Expected: FAIL — cannot resolve `./tickets.dto`.

- [ ] **Step 3: Write the DTOs**

Create `backend/src/controllers/tickets/tickets.dto.ts`:

```ts
import { TICKET_PRIORITIES, TICKET_STATES } from '@app/database';
import { ITicketCreatePromise, ITicketUpdatePromise } from '@app/tickets';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
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

const TICKET_SORTS = [
  'created_at',
  '-created_at',
  'updated_at',
  '-updated_at',
  'priority',
  '-priority',
  'state',
  '-state',
  'subject',
  '-subject',
];

const toArray = ({ value }: { value: unknown }): string[] => {
  if (Array.isArray(value)) {
    return (value as string[]).filter((item) => item.trim() !== '');
  }

  if (typeof value === 'string') {
    return [value.trim()];
  }

  return [];
};

export class ITicketIdParamDTO {
  @ApiProperty({
    description: 'Ticket id',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsUUID()
  id: string;
}

export class ITicketsListQueryDTO {
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
    example: '-created_at',
    type: 'string',
    enum: TICKET_SORTS,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(TICKET_SORTS)
  sort: string;

  @ApiPropertyOptional({
    description: 'State filter',
    example: 'NEW',
    type: 'array',
    enum: TICKET_STATES,
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsIn(Object.keys(TICKET_STATES), { each: true })
  @Transform(toArray)
  state?: (keyof typeof TICKET_STATES)[];

  @ApiPropertyOptional({
    description: 'Priority filter',
    example: 'URGENT',
    type: 'array',
    enum: TICKET_PRIORITIES,
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsIn(Object.keys(TICKET_PRIORITIES), { each: true })
  @Transform(toArray)
  priority?: (keyof typeof TICKET_PRIORITIES)[];

  @ApiPropertyOptional({
    description: 'Area filter',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  area_id?: string;

  @ApiPropertyOptional({
    description: 'Requester filter. Honoured for ADMIN/MASTER only',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  requester_login_id?: string;

  @ApiPropertyOptional({
    description: 'Responser filter. Honoured for ADMIN/MASTER only',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  responser_login_id?: string;
}

export class ITicketCreateDTO {
  @ApiPropertyOptional({
    description: 'Area the ticket belongs to',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  area_id?: string;

  @ApiProperty({
    description: 'Ticket subject',
    example: 'Printer is down',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({
    description: 'Ticket description',
    example: 'Third floor printer stopped responding after the power cut',
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class ITicketUpdateDTO {
  @ApiPropertyOptional({
    description: 'Area the ticket belongs to',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  area_id?: string;

  @ApiPropertyOptional({
    description: 'Requester login. Any role',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  requester_login_id?: string;

  @ApiPropertyOptional({
    description: 'Responser login. ADMIN or MASTER only',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  responser_login_id?: string;

  @ApiPropertyOptional({
    description: 'Ticket subject',
    example: 'Printer is down',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({
    description: 'Ticket description',
    example: 'Third floor printer stopped responding after the power cut',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({
    description: 'Ticket priority',
    example: 'URGENT',
    enum: Object.keys(TICKET_PRIORITIES),
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.keys(TICKET_PRIORITIES))
  priority?: keyof typeof TICKET_PRIORITIES;

  @ApiPropertyOptional({
    description: 'Ticket state',
    example: 'IN_PROGRESS',
    enum: Object.keys(TICKET_STATES),
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.keys(TICKET_STATES))
  state?: keyof typeof TICKET_STATES;
}

export class ITicketCreateResponseDTO implements ITicketCreatePromise {
  @ApiProperty({ format: 'uuid' })
  id: string;
}

export class ITicketUpdateResponseDTO implements ITicketUpdatePromise {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
```

- [ ] **Step 4: Run the test and the type-check**

Run: `npx jest src/controllers/tickets/tickets.dto.spec.ts`
Expected: PASS, 13 tests.

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'`
Expected: `18`.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/tickets/
git commit -F - <<'MSG'
feat(tickets): Add the tickets request and response DTOs

Query, param, body and response shapes for the five ticket routes. State
and priority filters normalise a single value into an array, matching how
the accounts list handles roles. An empty update body validates here and is
rejected by the controller service instead.
MSG
```

---

### Task 7: Controller service, controller and module registration

**Files:**
- Create: `backend/src/controllers/tickets/tickets.interface.ts`
- Create: `backend/src/controllers/tickets/tickets.service.ts`
- Create: `backend/src/controllers/tickets/tickets.controller.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/controllers/tickets/tickets.service.spec.ts` (create)
- Test: `backend/src/controllers/tickets/tickets.controller.spec.ts` (create)

**Interfaces:**
- Consumes: `TicketsService` and every interface from `@app/tickets`; the DTOs from Task 6; `Account` and `Roles` decorators.
- Produces: `TicketsControllerService`, `TicketsController`, both registered in `AppModule`.

- [ ] **Step 1: Write the controller-service interfaces**

Create `backend/src/controllers/tickets/tickets.interface.ts`:

```ts
import type { IAuthenticatedAccount } from '@app/auth';
import { ITicketCreateDTO, ITicketsListQueryDTO, ITicketUpdateDTO } from './tickets.dto';

export interface ITicketsListParams {
  account: IAuthenticatedAccount;
  query: ITicketsListQueryDTO;
}

export interface ITicketDetailParams {
  ticket_id: string;
  account: IAuthenticatedAccount;
}

export interface ITicketMessagesParams {
  ticket_id: string;
  account: IAuthenticatedAccount;
}

export interface ITicketCreateControllerParams {
  body: ITicketCreateDTO;
  ip: string;
  account: IAuthenticatedAccount;
}

export interface ITicketUpdateControllerParams {
  id: string;
  body: ITicketUpdateDTO;
  ip: string;
  account: IAuthenticatedAccount;
}
```

- [ ] **Step 2: Write the failing controller-service test**

Create `backend/src/controllers/tickets/tickets.service.spec.ts`:

```ts
import { TicketsService } from '@app/tickets';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsControllerService } from './tickets.service';

describe('TicketsControllerService', () => {
  let controllerService: TicketsControllerService;
  let ticketsService: jest.Mocked<TicketsService>;

  const ticket_id = '019538c4-2f7a-7c31-9c1b-000000000001';
  const account = {
    id: '019538c4-2f7a-7c31-9c1b-000000000002',
    username: 'admin',
    role: 'ADMIN' as const,
  };
  const ip = '127.0.0.1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsControllerService,
        {
          provide: TicketsService,
          useValue: {
            findManyWithPagination: jest.fn(),
            findOneById: jest.fn(),
            findMessagesByTicketId: jest.fn(),
            createOne: jest.fn(),
            updateOneById: jest.fn(),
          },
        },
      ],
    }).compile();

    controllerService = module.get(TicketsControllerService);
    ticketsService = module.get(TicketsService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should forward the account and the query to the domain list', async () => {
    const query = { per_page: 10, sort: '-created_at' };
    ticketsService.findManyWithPagination.mockResolvedValue({
      data: [],
    } as never);

    await controllerService.findAllWithPagination({ account, query });

    expect(ticketsService.findManyWithPagination).toHaveBeenCalledWith({
      account,
      per_page: 10,
      sort: '-created_at',
    });
  });

  it('should take the requester from the authenticated account on create', async () => {
    ticketsService.createOne.mockResolvedValue({ id: ticket_id });

    await controllerService.createOne({
      account,
      ip,
      body: { subject: 'Printer is down', description: 'No response' },
    });

    expect(ticketsService.createOne).toHaveBeenCalledWith({
      subject: 'Printer is down',
      description: 'No response',
      requester_login_id: account.id,
    });
  });

  it('should ignore a requester_login_id smuggled into the create body', async () => {
    ticketsService.createOne.mockResolvedValue({ id: ticket_id });

    await controllerService.createOne({
      account,
      ip,
      body: {
        subject: 'Printer is down',
        description: 'No response',
        requester_login_id: '019538c4-2f7a-7c31-9c1b-000000000009',
      } as never,
    });

    const [call] = ticketsService.createOne.mock.calls;
    expect(call[0].requester_login_id).toBe(account.id);
  });

  it('should reject an update with no updatable field', async () => {
    await expect(
      controllerService.updateOneById({ id: ticket_id, account, ip, body: {} }),
    ).rejects.toThrow(BadRequestException);
    expect(ticketsService.updateOneById).not.toHaveBeenCalled();
  });

  it('should pass an update through with the id merged in', async () => {
    ticketsService.updateOneById.mockResolvedValue({ id: ticket_id });

    await controllerService.updateOneById({
      id: ticket_id,
      account,
      ip,
      body: { state: 'RESOLVED' },
    });

    expect(ticketsService.updateOneById).toHaveBeenCalledWith({
      id: ticket_id,
      state: 'RESOLVED',
    });
  });
});
```

- [ ] **Step 3: Write the controller service**

Create `backend/src/controllers/tickets/tickets.service.ts`:

```ts
import {
  ITicketCreatePromise,
  ITicketDetailPromise,
  ITicketListWithPaginationPromise,
  ITicketMessageItemListPromise,
  ITicketUpdatePromise,
  TicketsService,
} from '@app/tickets';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ITicketCreateControllerParams,
  ITicketDetailParams,
  ITicketMessagesParams,
  ITicketsListParams,
  ITicketUpdateControllerParams,
} from './tickets.interface';

@Injectable()
export class TicketsControllerService {
  private readonly logger = new Logger(TicketsControllerService.name);

  constructor(private readonly ticketsService: TicketsService) {}

  async findAllWithPagination(
    params: ITicketsListParams,
  ): Promise<ITicketListWithPaginationPromise> {
    const { account, query } = params;

    return await this.ticketsService.findManyWithPagination({
      account,
      ...query,
    });
  }

  async findOneById(
    params: ITicketDetailParams,
  ): Promise<ITicketDetailPromise> {
    const { ticket_id, account } = params;

    return await this.ticketsService.findOneById({ ticket_id, account });
  }

  async findMessages(
    params: ITicketMessagesParams,
  ): Promise<ITicketMessageItemListPromise[]> {
    const { ticket_id, account } = params;

    return await this.ticketsService.findMessagesByTicketId({
      ticket_id,
      account,
    });
  }

  async createOne(
    params: ITicketCreateControllerParams,
  ): Promise<ITicketCreatePromise> {
    const { body, ip, account } = params;

    const serviceResult = await this.ticketsService.createOne({
      subject: body.subject,
      description: body.description,
      ...(body.area_id && { area_id: body.area_id }),
      requester_login_id: account.id,
    });

    this.logger.log(
      `[createOne] - LOGINID:${account.id} | TICKETID:${serviceResult.id} | IP:${ip} - TICKET CREATED`,
    );

    return serviceResult;
  }

  async updateOneById(
    params: ITicketUpdateControllerParams,
  ): Promise<ITicketUpdatePromise> {
    const { id, body, ip, account } = params;

    const hasUpdatableField = [
      body.area_id,
      body.requester_login_id,
      body.responser_login_id,
      body.subject,
      body.description,
      body.priority,
      body.state,
    ].some((field) => field !== undefined);

    if (!hasUpdatableField) throw new BadRequestException('empty_payload');

    const serviceResult = await this.ticketsService.updateOneById({
      id,
      ...body,
    });

    this.logger.log(
      `[updateOneById] - LOGINID:${account.id} | TICKETID:${serviceResult.id} | IP:${ip} - TICKET UPDATED`,
    );

    return serviceResult;
  }
}
```

Two details that matter:

1. `createOne` names `subject` and `description` explicitly rather than spreading `body`. A spread would let a `requester_login_id` in the body override the authenticated account — the global `whitelist` pipe already strips it, but the controller service must not depend on a pipe setting for an authorization-relevant field.
2. `hasUpdatableField` checks each field against `undefined` instead of using `Object.keys(body).length`. The compile target is ES2023, so `useDefineForClassFields` is on and every declared DTO property exists on the instance as `undefined` — `Object.keys` would always report seven keys and the empty-body check would never fire.

- [ ] **Step 4: Run the controller-service test**

Run: `npx jest src/controllers/tickets/tickets.service.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing controller test**

Create `backend/src/controllers/tickets/tickets.controller.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsControllerService } from './tickets.service';

describe('TicketsController', () => {
  let controller: TicketsController;
  let controllerService: jest.Mocked<TicketsControllerService>;

  const ticket_id = '019538c4-2f7a-7c31-9c1b-000000000001';
  const account = {
    id: '019538c4-2f7a-7c31-9c1b-000000000002',
    username: 'admin',
    role: 'ADMIN' as const,
  };
  const ip = '127.0.0.1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsControllerService,
          useValue: {
            findAllWithPagination: jest.fn(),
            findOneById: jest.fn(),
            findMessages: jest.fn(),
            createOne: jest.fn(),
            updateOneById: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(TicketsController);
    controllerService = module.get(TicketsControllerService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should hand the account and query to the list', async () => {
    const query = { per_page: 10, sort: '-created_at' };
    await controller.list(account, query as never);

    expect(controllerService.findAllWithPagination).toHaveBeenCalledWith({
      account,
      query,
    });
  });

  it('should map the id param to ticket_id on the detail', async () => {
    await controller.detail(account, { id: ticket_id });

    expect(controllerService.findOneById).toHaveBeenCalledWith({
      ticket_id,
      account,
    });
  });

  it('should map the id param to ticket_id on the message thread', async () => {
    await controller.messages(account, { id: ticket_id });

    expect(controllerService.findMessages).toHaveBeenCalledWith({
      ticket_id,
      account,
    });
  });

  it('should forward the create body with the ip and account', async () => {
    const body = { subject: 'Printer is down', description: 'No response' };
    await controller.create(account, ip, body);

    expect(controllerService.createOne).toHaveBeenCalledWith({
      body,
      ip,
      account,
    });
  });

  it('should forward the update body with the id', async () => {
    const body = { state: 'RESOLVED' as const };
    await controller.update(account, ip, { id: ticket_id }, body);

    expect(controllerService.updateOneById).toHaveBeenCalledWith({
      id: ticket_id,
      body,
      ip,
      account,
    });
  });
});
```

Route ordering is not asserted here — a unit test cannot see Nest's route table. It is verified in Step 8 by booting the app and reading the mapped routes.

- [ ] **Step 6: Write the controller**

Create `backend/src/controllers/tickets/tickets.controller.ts`:

```ts
import type { IAuthenticatedAccount } from '@app/auth';
import { LOGIN_ROLES } from '@app/database';
import {
  ITicketCreatePromise,
  ITicketDetailPromise,
  ITicketListWithPaginationPromise,
  ITicketMessageItemListPromise,
  ITicketUpdatePromise,
} from '@app/tickets';
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
  ITicketCreateDTO,
  ITicketCreateResponseDTO,
  ITicketIdParamDTO,
  ITicketsListQueryDTO,
  ITicketUpdateDTO,
  ITicketUpdateResponseDTO,
} from './tickets.dto';
import { TicketsControllerService } from './tickets.service';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly controllerService: TicketsControllerService) {}

  @ApiOperation({
    summary: 'Get tickets list',
    description:
      'Return a paginated list of tickets with the number of messages on each. A USER only ever sees the tickets they requested; ADMIN and MASTER see every ticket and may filter by requester or responser.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(ITicketsListQueryDTO)
  @ApiResponse({ status: 200, description: 'Tickets list.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request query.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @Get('list')
  async list(
    @Account() account: IAuthenticatedAccount,
    @Query() query: ITicketsListQueryDTO,
  ): Promise<ITicketListWithPaginationPromise> {
    return await this.controllerService.findAllWithPagination({
      account,
      query,
    });
  }

  @ApiOperation({
    summary: 'Create new ticket',
    description:
      'Creates a ticket for the authenticated account. Priority and state take their defaults, NORMAL and NEW.',
  })
  @ApiBearerAuth('bearer')
  @ApiBody({ type: ITicketCreateDTO })
  @ApiResponse({
    status: 201,
    description: 'Ticket created successfully.',
    type: ITicketCreateResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request body.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 422, description: 'The area does not exist.' })
  @Post('create')
  async create(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Body() body: ITicketCreateDTO,
  ): Promise<ITicketCreatePromise> {
    return await this.controllerService.createOne({ body, ip, account });
  }

  @ApiOperation({
    summary: 'Get a ticket',
    description:
      'Return the full ticket with its message count. A ticket outside the caller scope answers 404, not 403.',
  })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'Ticket detail.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request params.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @Get(':id')
  async detail(
    @Account() account: IAuthenticatedAccount,
    @Param() params: ITicketIdParamDTO,
  ): Promise<ITicketDetailPromise> {
    return await this.controllerService.findOneById({
      ticket_id: params.id,
      account,
    });
  }

  @ApiOperation({
    summary: 'Get a ticket message thread',
    description:
      'Return every message on the ticket, newest first, without pagination.',
  })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'Message thread.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request params.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @Get(':id/messages')
  async messages(
    @Account() account: IAuthenticatedAccount,
    @Param() params: ITicketIdParamDTO,
  ): Promise<ITicketMessageItemListPromise[]> {
    return await this.controllerService.findMessages({
      ticket_id: params.id,
      account,
    });
  }

  @ApiOperation({
    summary: 'Update a ticket',
    description:
      'Updates the area, the requester, the responser, the subject, the description, the priority or the state.',
  })
  @ApiBearerAuth('bearer')
  @ApiBody({ type: ITicketUpdateDTO })
  @ApiResponse({
    status: 200,
    description: 'Ticket updated successfully.',
    type: ITicketUpdateResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed, or the request body is empty.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @ApiResponse({
    status: 422,
    description:
      'The area, the requester or the responser is invalid for this ticket.',
  })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Put(':id')
  async update(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Param() params: ITicketIdParamDTO,
    @Body() body: ITicketUpdateDTO,
  ): Promise<ITicketUpdatePromise> {
    return await this.controllerService.updateOneById({
      id: params.id,
      body,
      ip,
      account,
    });
  }
}
```

Only `update` carries `@Roles()`. The four read/create routes intentionally have none — `RoleGuard` returns `true` when the metadata is absent, so `JwtAuthGuard` alone gates them and the scope resolver narrows what comes back.

`@Get('list')` and `@Post('create')` are declared before `@Get(':id')`. Keep that order.

- [ ] **Step 7: Register in `AppModule`**

In `backend/src/app.module.ts`: add `import { TicketsModule } from '@app/tickets';`, the controller and controller-service imports, then add `TicketsModule` to `imports`, `TicketsController` to `controllers`, and `TicketsControllerService` to `providers`.

- [ ] **Step 8: Run everything and verify the route table**

Run: `npx jest src/controllers/tickets/ libs/tickets/ libs/database/src/repositories/`
Expected: PASS on every suite.

Run: `npx jest 2>&1 | tail -5`
Expected: `Tests: 25 failed, <134 + new> passed` — the 25 inherited failures unchanged, zero new failures.

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'`
Expected: `18`.

Verify the routes register without a collision:

```bash
npx ts-node -e "
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./src/app.module');
NestFactory.create(AppModule, { logger: ['log'] })
  .then((app) => app.init())
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
"
```

Expected: the log lists `Mapped {/tickets/list, GET}`, `Mapped {/tickets/create, POST}`, `Mapped {/tickets/:id, GET}`, `Mapped {/tickets/:id/messages, GET}`, `Mapped {/tickets/:id, PUT}` with `list` and `create` appearing before `:id`. If the boot fails for a reason unrelated to routing — a missing Redis or Postgres connection — record that and rely on the unit suites instead; a connection error is not a routing failure.

- [ ] **Step 9: Commit**

```bash
git add src/controllers/tickets/ src/app.module.ts
git commit -F - <<'MSG'
feat(tickets): Add the tickets controller and wire the domain in

Five routes: a scoped paginated list, a cached detail, a cached message
thread, create for any authenticated account, and an ADMIN/MASTER update.
Only the update carries a role gate; the read routes rely on the domain
scope resolver instead. The create requester always comes from the token,
never from the body.
MSG
```

---

## Verification

Run from `backend/` once every task is committed:

1. `npx jest` — 25 failures, all of them in the six suites inherited from `main`. Every `tickets` suite green.
2. `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'` — `18`.
3. `git log --oneline` — seven commits, no `Co-Authored-By` trailer and no AI attribution anywhere in any message.
4. `git status` — clean.
5. No changes to `schema.prisma`, no migration directory, no `package-lock.json` churn.
