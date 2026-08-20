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
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
    errorHandler: jest.Mock;
  };

  beforeEach(async () => {
    database = {
      tickets: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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

  afterEach(() => {
    jest.resetAllMocks();
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

    it('should return a well-formed empty page when no records are found', async () => {
      database.tickets.count.mockResolvedValue(0);
      database.tickets.findMany.mockResolvedValue([]);

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
  });

  describe('findOne', () => {
    const ticketId = '019538c4-2f7a-7c31-9c1b-000000000001';
    const loginId = '019538c4-2f7a-7c31-9c1b-000000000002';
    const areaId = '019538c4-2f7a-7c31-9c1b-000000000003';

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
    const ticketId = '019538c4-2f7a-7c31-9c1b-000000000001';
    const loginId = '019538c4-2f7a-7c31-9c1b-000000000002';
    const areaId = '019538c4-2f7a-7c31-9c1b-000000000003';
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
    const ticketId = '019538c4-2f7a-7c31-9c1b-000000000001';
    const loginId = '019538c4-2f7a-7c31-9c1b-000000000002';

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