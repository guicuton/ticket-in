import { CacheModuleServices } from '@app/cache';
import {
  AreasRepository,
  LoginsRepository,
  TicketMessagesRepository,
  TicketsRepository,
} from '@app/database';
import { UnprocessableEntityException } from '@nestjs/common';
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
});
