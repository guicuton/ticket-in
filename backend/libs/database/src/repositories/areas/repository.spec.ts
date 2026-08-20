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
