import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database.service';
import { TicketMessagesRepository } from './repository.service';

describe('TicketMessagesRepository', () => {
  let repository: TicketMessagesRepository;
  let database: {
    ticket_messages: {
      count: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
    };
    tickets: { update: jest.Mock };
    $transaction: jest.Mock;
    errorHandler: jest.Mock;
  };

  beforeEach(async () => {
    database = {
      ticket_messages: {
        count: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      tickets: { update: jest.fn() },
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

  describe('createOne', () => {
    const ticketId = '019538c4-2f7a-7c31-9c1b-000000000001';
    const loginId = '019538c4-2f7a-7c31-9c1b-000000000002';
    const createdAt = new Date('2026-08-20T12:00:00.000Z');

    const params = {
      ticket_id: ticketId,
      login_id: loginId,
      message: 'the printer is still down',
      created_at: createdAt,
    };

    it('should insert the message and stamp the ticket inside a single transaction', async () => {
      database.ticket_messages.create.mockResolvedValue({ id: 'message-id' });
      database.tickets.update.mockResolvedValue({ id: ticketId });

      const result = await repository.createOne(params);

      expect(database.$transaction).toHaveBeenCalledTimes(1);
      expect(database.ticket_messages.create).toHaveBeenCalledWith({
        data: {
          ticket_id: ticketId,
          login_id: loginId,
          message: params.message,
          created_at: createdAt,
        },
        select: { id: true },
      });
      expect(result).toEqual({ id: 'message-id' });
    });

    it('should write the next state on the ticket when one is given', async () => {
      database.ticket_messages.create.mockResolvedValue({ id: 'message-id' });
      database.tickets.update.mockResolvedValue({ id: ticketId });

      await repository.createOne({ ...params, state: 'WAITING_FEEDBACK' });

      expect(database.tickets.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { updated_at: createdAt, state: 'WAITING_FEEDBACK' },
        select: { id: true },
      });
    });

    it('should stamp updated_at without touching state when no next state is given', async () => {
      database.ticket_messages.create.mockResolvedValue({ id: 'message-id' });
      database.tickets.update.mockResolvedValue({ id: ticketId });

      await repository.createOne(params);

      expect(database.tickets.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { updated_at: createdAt },
        select: { id: true },
      });
    });

    it('should stamp the ticket with the same instant carried by the message', async () => {
      database.ticket_messages.create.mockResolvedValue({ id: 'message-id' });
      database.tickets.update.mockResolvedValue({ id: ticketId });

      await repository.createOne(params);

      const messageArgs = database.ticket_messages.create.mock.calls[0][0] as {
        data: { created_at: Date };
      };
      const ticketArgs = database.tickets.update.mock.calls[0][0] as {
        data: { updated_at: Date };
      };

      expect(ticketArgs.data.updated_at).toBe(messageArgs.data.created_at);
    });

    it('should delegate errors to errorHandler and return undefined when the handler swallows', async () => {
      const error = new Error('prisma');
      database.$transaction.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.createOne(params);

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });
});
