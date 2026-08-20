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
      create: jest.Mock;
      update: jest.Mock;
    };
    logins_assigned_areas: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
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
        create: jest.fn(),
        update: jest.fn(),
      },
      logins_assigned_areas: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
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

  describe('findOneById', () => {
    const areaId = '019538c4-2f7a-7c31-9c1b-000000000002';

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
});
