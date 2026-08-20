import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database.service';
import { TicketsRepository } from './repository.service';

describe('TicketsRepository', () => {
  let repository: TicketsRepository;
  let database: {
    tickets: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
    errorHandler: jest.Mock;
  };

  beforeEach(async () => {
    database = {
      tickets: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(database)),
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

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findManyWithPagination', () => {
    const params = {
      where: { requester_id: 'login-id' },
      offset: 10,
      per_page: 30,
      sort: {
        column: 'created_at',
        direction: 'desc' as const,
      },
    };

    it('should call tickets.findMany with take, skip, where and orderBy derived from the params', async () => {
      database.tickets.count.mockResolvedValue(1);
      database.tickets.findMany.mockResolvedValue([{ id: 'ticket-id' }]);

      await repository.findManyWithPagination(params);

      expect(database.tickets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: params.per_page,
          skip: params.offset,
          where: params.where,
          orderBy: { created_at: 'desc' },
        }),
      );
    });

    it('should return the paginated data when the query resolves', async () => {
      database.tickets.count.mockResolvedValue(1);
      database.tickets.findMany.mockResolvedValue([{ id: 'ticket-id' }]);

      const result = await repository.findManyWithPagination(params);

      expect(result).toEqual(
        expect.objectContaining({
          data: [{ id: 'ticket-id' }],
        }),
      );
    });

    it('should return undefined when no records are found', async () => {
      database.tickets.count.mockResolvedValue(0);
      database.tickets.findMany.mockResolvedValue([]);

      const result = await repository.findManyWithPagination(params);

      expect(result).toBeUndefined();
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
});
