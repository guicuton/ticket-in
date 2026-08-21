import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database.service';
import { LoginsRepository } from './repository.service';
import { ILoginsCreateOneParams } from './repository.interface';

describe('LoginsRepository', () => {
  let repository: LoginsRepository;
  let database: {
    logins: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
    errorHandler: jest.Mock;
  };

  const loginId = '019538c4-2f7a-7c31-9c1b-000000000001';

  beforeEach(async () => {
    database = {
      logins: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(database)),
      errorHandler: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginsRepository,
        { provide: DatabaseService, useValue: database },
      ],
    }).compile();

    repository = module.get(LoginsRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('createOne', () => {
    const params: ILoginsCreateOneParams = {
      username: 'admin',
      password: 'hash',
      email: 'a@b.com',
      role: 'ADMIN',
      created_at: new Date(),
    };

    it('should call login.create with the params and return the created row', async () => {
      const expected = { id: loginId };
      database.logins.create.mockResolvedValue(expected);

      const result = await repository.createOne(params);

      expect(database.logins.create).toHaveBeenCalledWith({
        data: params,
        select: { id: true },
      });
      expect(result).toBe(expected);
    });

    it('should delegate Prisma errors to errorHandler and return undefined when handler swallows', async () => {
      const error = new Error('prisma');
      database.logins.create.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.createOne(params);

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });

  describe('findOneById', () => {
    it('should call login.findUnique with the id and return the row', async () => {
      const expected = { id: loginId, password: 'hash' };
      database.logins.findUnique.mockResolvedValue(expected);

      const result = await repository.findOneById(loginId);

      expect(database.logins.findUnique).toHaveBeenCalledWith({
        where: { id: loginId },
        select: { id: true, password: true },
      });
      expect(result).toBe(expected);
    });
  });

  describe('findOneByUsernameOrEmail', () => {
    it('should call login.findFirst with the params and return the row', async () => {
      const params = { username: 'admin' };
      const expected = { id: loginId, password: 'hash' };
      database.logins.findFirst.mockResolvedValue(expected);

      const result = await repository.findOneByUsernameOrEmail(params);

      expect(database.logins.findFirst).toHaveBeenCalledWith({
        where: params,
        select: { id: true, password: true, role: true },
      });
      expect(result).toBe(expected);
    });
  });

  describe('updatePasswordById', () => {
    it('should call login.update with the new hash and where id', async () => {
      const expected = { id: loginId };
      database.logins.update.mockResolvedValue(expected);

      const result = await repository.updatePasswordById({
        login_id: loginId,
        password_hash: 'new-hash',
      });

      expect(database.logins.update).toHaveBeenCalledWith({
        data: { password: 'new-hash' },
        where: { id: loginId },
        select: { id: true },
      });
      expect(result).toBe(expected);
    });
  });

  describe('findManyWithPagination', () => {
    const params = {
      where: {},
      per_page: 10,
      sort: { column: 'created_at', direction: 'desc' as const },
    };

    const safeColumns = [
      'id',
      'username',
      'email',
      'role',
      'is_deleted',
      'created_at',
      'updated_at',
    ];

    const selectOf = () =>
      (
        database.logins.findMany.mock.calls[0][0] as {
          select: Record<string, unknown>;
        }
      ).select;

    beforeEach(() => {
      database.logins.count.mockResolvedValue(1);
      database.logins.findMany.mockResolvedValue([{ id: loginId }]);
    });

    it('should never select the password column', async () => {
      await repository.findManyWithPagination(params);

      expect(selectOf()).not.toHaveProperty('password');
    });

    it('should pin the projection to an allow list, so a new column is not exposed by default', async () => {
      await repository.findManyWithPagination(params);

      expect(Object.keys(selectOf()).sort()).toEqual(
        [...safeColumns, '_count'].sort(),
      );
    });

    it('should keep every safe column selected', async () => {
      await repository.findManyWithPagination(params);

      const select = selectOf();

      safeColumns.forEach((column) => expect(select[column]).toBe(true));
    });

    it('should count the relations the list reports', async () => {
      await repository.findManyWithPagination(params);

      expect(selectOf()._count).toEqual({
        select: {
          assigned_areas: true,
          tickets_messages: true,
          tickets_requester: true,
          tickets_responser: true,
        },
      });
    });

    it('should never pass include alongside select, which Prisma rejects', async () => {
      await repository.findManyWithPagination(params);

      expect(database.logins.findMany.mock.calls[0][0]).not.toHaveProperty(
        'include',
      );
    });

    it('should carry the where, paging and ordering through', async () => {
      await repository.findManyWithPagination({
        ...params,
        offset: 20,
        where: { role: { in: ['ADMIN'] } },
      });

      expect(database.logins.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
          where: { role: { in: ['ADMIN'] } },
          orderBy: { created_at: 'desc' },
        }),
      );
    });

    it('should delegate Prisma errors to errorHandler and return undefined when handler swallows', async () => {
      const error = new Error('prisma');
      database.logins.count.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.findManyWithPagination(params);

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });
});

describe('LoginsRepository', () => {
  let repository: LoginsRepository;
  let database: {
    logins: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    errorHandler: jest.Mock;
  };

  const loginId = '019538c4-2f7a-7c31-9c1b-000000000001';

  beforeEach(async () => {
    database = {
      logins: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      errorHandler: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginsRepository,
        { provide: DatabaseService, useValue: database },
      ],
    }).compile();

    repository = module.get(LoginsRepository);
  });

  describe('findAssignedAreasById', () => {
    it('should call logins.findUnique with the id and the assigned areas select shape', async () => {
      const expected = {
        assigned_areas: [{ areas: { id: 'area-id', alias: 'support' } }],
      };
      database.logins.findUnique.mockResolvedValue(expected);

      await repository.findAssignedAreasById(loginId);

      expect(database.logins.findUnique).toHaveBeenCalledWith({
        where: { id: loginId },
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
      });
    });

    it('should return the row containing the assigned areas', async () => {
      const expected = {
        assigned_areas: [{ areas: { id: 'area-id', alias: 'support' } }],
      };
      database.logins.findUnique.mockResolvedValue(expected);

      const result = await repository.findAssignedAreasById(loginId);

      expect(result).toBe(expected);
    });

    it('should delegate Prisma errors to errorHandler and return undefined when handler swallows', async () => {
      const error = new Error('prisma');
      database.logins.findUnique.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.findAssignedAreasById(loginId);

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });

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
});
