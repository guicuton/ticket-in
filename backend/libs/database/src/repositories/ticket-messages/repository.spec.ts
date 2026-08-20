import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database.service';
import { TicketMessagesRepository } from './repository.service';

describe('TicketMessagesRepository', () => {
  let repository: TicketMessagesRepository;
  let database: {
    ticket_messages: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
    errorHandler: jest.Mock;
  };

  beforeEach(async () => {
    database = {
      ticket_messages: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(database)),
      errorHandler: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketMessagesRepository,
        { provide: DatabaseService, useValue: database },
      ],
    }).compile();

    repository = module.get(TicketMessagesRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findManyWithPagination', () => {
    const params = {
      where: { ticket_id: 'ticket-id' },
      offset: 20,
      per_page: 10,
      sort: {
        column: 'created_at',
        direction: 'asc' as const,
      },
    };

    it('should call ticket_messages.findMany with take, skip, where and orderBy derived from the params', async () => {
      database.ticket_messages.count.mockResolvedValue(1);
      database.ticket_messages.findMany.mockResolvedValue([
        { id: 'message-id' },
      ]);

      await repository.findManyWithPagination(params);

      expect(database.ticket_messages.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: params.per_page,
          skip: params.offset,
          where: params.where,
          orderBy: { created_at: 'asc' },
        }),
      );
    });

    it('should return the paginated data when the query resolves', async () => {
      database.ticket_messages.count.mockResolvedValue(1);
      database.ticket_messages.findMany.mockResolvedValue([
        { id: 'message-id' },
      ]);

      const result = await repository.findManyWithPagination(params);

      expect(result).toEqual(
        expect.objectContaining({
          data: [{ id: 'message-id' }],
        }),
      );
    });

    it('should return a well-formed empty page when no records are found', async () => {
      database.ticket_messages.count.mockResolvedValue(0);
      database.ticket_messages.findMany.mockResolvedValue([]);

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

  describe('findManyByTicketId', () => {
    const ticketId = '019538c4-2f7a-7c31-9c1b-000000000001';

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
});
