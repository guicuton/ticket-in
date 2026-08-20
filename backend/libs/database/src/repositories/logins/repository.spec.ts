import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database.service';
import { LoginsRepository } from './repository.service';

describe('LoginsRepository', () => {
  let repository: LoginsRepository;
  let database: {
    logins: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    errorHandler: jest.Mock;
  };

  const loginId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    database = {
      logins: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
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

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('createOne', () => {
    const params = {
      username: 'admin',
      password: 'hash',
      email: 'a@b.com',
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

  const loginId = '00000000-0000-0000-0000-000000000001';

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
