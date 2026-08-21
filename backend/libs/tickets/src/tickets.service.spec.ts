import { CacheModuleServices } from '@app/cache';
import {
  AreasRepository,
  LoginsRepository,
  TicketMessagesRepository,
  TicketsRepository,
} from '@app/database';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_TTL } from '../../../configuration/constants';
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
          useValue: { findManyByTicketId: jest.fn(), createOne: jest.fn() },
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
          ttl: CACHE_TTL.ten,
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
      ).rejects.toThrow('ticket_not_found');
    });

    it('should 404 a USER reading another account ticket from the repository', async () => {
      cache.get.mockResolvedValue(undefined);
      repository.findOne.mockResolvedValue({
        ...detail,
        requester_login_id: other_login_id,
      } as never);

      await expect(
        service.findOneById({ ticket_id, account: user }),
      ).rejects.toThrow('ticket_not_found');
    });

    it('should let an ADMIN read a ticket they do not own', async () => {
      const otherAccountTicket = {
        ...detail,
        requester_login_id: other_login_id,
      };
      cache.get.mockResolvedValue(otherAccountTicket as never);

      const result = await service.findOneById({
        ticket_id,
        account: admin,
      });

      expect(result).toBe(otherAccountTicket);
    });

    it('should 404 when the ticket does not exist', async () => {
      cache.get.mockResolvedValue(undefined);
      repository.findOne.mockResolvedValue(undefined);

      await expect(
        service.findOneById({ ticket_id, account: admin }),
      ).rejects.toThrow('ticket_not_found');
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('should treat an account with no role as non-privileged', async () => {
      cache.get.mockResolvedValue({
        ...detail,
        requester_login_id: other_login_id,
      } as never);

      await expect(
        service.findOneById({ ticket_id, account: { id: user.id } }),
      ).rejects.toThrow('ticket_not_found');
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
      ).rejects.toThrow('ticket_not_found');
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
          ttl: CACHE_TTL.ten,
        }),
      );
      expect(result).toBe(thread);
    });
  });

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

  describe('createMessage', () => {
    const master: ITicketScopedAccount = {
      id: '019538c4-2f7a-7c31-9c1b-000000000006',
      role: 'MASTER',
    };
    const message = 'the printer is still down';

    const detailOn = (state: string, requester = user.id) => ({
      id: ticket_id,
      requester_login_id: requester,
      state,
    });

    const created = { id: '019538c4-2f7a-7c31-9c1b-000000000007' };

    it('should authorize through the ticket before writing anything', async () => {
      cache.get.mockResolvedValue(
        detailOn('NEW', other_login_id) as never,
      );

      await expect(
        service.createMessage({ ticket_id, account: user, message }),
      ).rejects.toThrow(NotFoundException);

      expect(ticketMessagesRepository.createOne).not.toHaveBeenCalled();
      expect(cache.delete).not.toHaveBeenCalled();
    });

    it('should raise 422 ticket_resolved and write nothing on a resolved ticket', async () => {
      cache.get.mockResolvedValue(detailOn('RESOLVED') as never);

      await expect(
        service.createMessage({ ticket_id, account: user, message }),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(ticketMessagesRepository.createOne).not.toHaveBeenCalled();
    });

    it('should close the resolved ticket to privileged accounts too', async () => {
      cache.get.mockResolvedValue(detailOn('RESOLVED') as never);

      await expect(
        service.createMessage({
          ticket_id,
          account: admin,
          message,
          state: 'IN_PROGRESS',
        }),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(ticketMessagesRepository.createOne).not.toHaveBeenCalled();
    });

    it('should write the state an ADMIN chooses', async () => {
      cache.get.mockResolvedValue(detailOn('NEW') as never);
      ticketMessagesRepository.createOne.mockResolvedValue(created as never);

      const result = await service.createMessage({
        ticket_id,
        account: admin,
        message,
        state: 'ESCALATED',
      });

      expect(ticketMessagesRepository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({
          ticket_id,
          login_id: admin.id,
          message,
          state: 'ESCALATED',
        }),
      );
      expect(result).toEqual({ id: created.id, state: 'ESCALATED' });
    });

    it('should write the state a MASTER chooses', async () => {
      cache.get.mockResolvedValue(detailOn('NEW') as never);
      ticketMessagesRepository.createOne.mockResolvedValue(created as never);

      const result = await service.createMessage({
        ticket_id,
        account: master,
        message,
        state: 'RESOLVED',
      });

      expect(ticketMessagesRepository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'RESOLVED', login_id: master.id }),
      );
      expect(result.state).toBe('RESOLVED');
    });

    it('should raise 400 state_required when a privileged account omits the state', async () => {
      cache.get.mockResolvedValue(detailOn('NEW') as never);

      await expect(
        service.createMessage({ ticket_id, account: admin, message }),
      ).rejects.toThrow(BadRequestException);

      expect(ticketMessagesRepository.createOne).not.toHaveBeenCalled();
    });

    it('should raise 400 state_not_allowed when a USER sends a state', async () => {
      cache.get.mockResolvedValue(detailOn('NEW') as never);

      await expect(
        service.createMessage({
          ticket_id,
          account: user,
          message,
          state: 'RESOLVED',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(ticketMessagesRepository.createOne).not.toHaveBeenCalled();
    });

    it('should move a USER message on WAITING_FEEDBACK to IN_PROGRESS', async () => {
      cache.get.mockResolvedValue(detailOn('WAITING_FEEDBACK') as never);
      ticketMessagesRepository.createOne.mockResolvedValue(created as never);

      const result = await service.createMessage({
        ticket_id,
        account: user,
        message,
      });

      expect(ticketMessagesRepository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'IN_PROGRESS', login_id: user.id }),
      );
      expect(result).toEqual({ id: created.id, state: 'IN_PROGRESS' });
    });

    it.each(['NEW', 'IN_PROGRESS', 'ESCALATED'])(
      'should leave the state untouched for a USER message on %s',
      async (state) => {
        cache.get.mockResolvedValue(detailOn(state) as never);
        ticketMessagesRepository.createOne.mockResolvedValue(created as never);

        const result = await service.createMessage({
          ticket_id,
          account: user,
          message,
        });

        const args = ticketMessagesRepository.createOne.mock.calls[0][0];

        expect(args.state).toBeUndefined();
        expect(result).toEqual({ id: created.id, state });
      },
    );

    it('should stamp the message with a creation instant', async () => {
      cache.get.mockResolvedValue(detailOn('NEW') as never);
      ticketMessagesRepository.createOne.mockResolvedValue(created as never);

      await service.createMessage({ ticket_id, account: user, message });

      const args = ticketMessagesRepository.createOne.mock.calls[0][0];

      expect(args.created_at).toBeInstanceOf(Date);
    });

    it('should drop both cache entries for the ticket after writing', async () => {
      cache.get.mockResolvedValue(detailOn('NEW') as never);
      ticketMessagesRepository.createOne.mockResolvedValue(created as never);

      await service.createMessage({ ticket_id, account: user, message });

      expect(cache.delete).toHaveBeenCalledWith([
        `tickets:detail:${ticket_id}`,
        `tickets:messages:${ticket_id}`,
      ]);
    });

    it('should raise 422 repository_error and skip invalidation when the write yields nothing', async () => {
      cache.get.mockResolvedValue(detailOn('NEW') as never);
      ticketMessagesRepository.createOne.mockResolvedValue(undefined as never);

      await expect(
        service.createMessage({ ticket_id, account: user, message }),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(cache.delete).not.toHaveBeenCalled();
    });
  });
});
