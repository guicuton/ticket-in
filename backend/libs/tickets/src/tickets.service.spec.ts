import { CacheModuleServices } from '@app/cache';
import {
  AreasRepository,
  LoginsRepository,
  TicketMessagesRepository,
  TicketsRepository,
} from '@app/database';
import { UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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
});
