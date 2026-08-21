import { TicketsService } from '@app/tickets';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsControllerService } from './tickets.service';

describe('TicketsControllerService', () => {
  let controllerService: TicketsControllerService;
  let ticketsService: jest.Mocked<TicketsService>;

  const ticket_id = '019538c4-2f7a-7c31-9c1b-000000000001';
  const account = {
    id: '019538c4-2f7a-7c31-9c1b-000000000002',
    username: 'admin',
    role: 'ADMIN' as const,
  };
  const ip = '127.0.0.1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsControllerService,
        {
          provide: TicketsService,
          useValue: {
            findManyWithPagination: jest.fn(),
            findOneById: jest.fn(),
            findMessagesByTicketId: jest.fn(),
            createOne: jest.fn(),
            createMessage: jest.fn(),
            updateOneById: jest.fn(),
          },
        },
      ],
    }).compile();

    controllerService = module.get(TicketsControllerService);
    ticketsService = module.get(TicketsService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should forward the account and the query to the domain list', async () => {
    const query = { per_page: 10, sort: '-created_at' };
    ticketsService.findManyWithPagination.mockResolvedValue({
      data: [],
    } as never);

    await controllerService.findAllWithPagination({ account, query });

    expect(ticketsService.findManyWithPagination).toHaveBeenCalledWith({
      account,
      per_page: 10,
      sort: '-created_at',
    });
  });

  it('should take the requester from the authenticated account on create', async () => {
    ticketsService.createOne.mockResolvedValue({ id: ticket_id });

    await controllerService.createOne({
      account,
      ip,
      body: { subject: 'Printer is down', description: 'No response' },
    });

    expect(ticketsService.createOne).toHaveBeenCalledWith({
      subject: 'Printer is down',
      description: 'No response',
      requester_login_id: account.id,
    });
  });

  it('should ignore a requester_login_id smuggled into the create body', async () => {
    ticketsService.createOne.mockResolvedValue({ id: ticket_id });

    await controllerService.createOne({
      account,
      ip,
      body: {
        subject: 'Printer is down',
        description: 'No response',
        requester_login_id: '019538c4-2f7a-7c31-9c1b-000000000009',
      } as never,
    });

    const [call] = ticketsService.createOne.mock.calls;
    expect(call[0].requester_login_id).toBe(account.id);
  });

  it('should reject an update with no updatable field', async () => {
    await expect(
      controllerService.updateOneById({ id: ticket_id, account, ip, body: {} }),
    ).rejects.toThrow(BadRequestException);
    expect(ticketsService.updateOneById).not.toHaveBeenCalled();
  });

  it('should pass an update through with the id merged in', async () => {
    ticketsService.updateOneById.mockResolvedValue({ id: ticket_id });

    await controllerService.updateOneById({
      id: ticket_id,
      account,
      ip,
      body: { state: 'RESOLVED' },
    });

    expect(ticketsService.updateOneById).toHaveBeenCalledWith({
      id: ticket_id,
      state: 'RESOLVED',
    });
  });

  it('should name the message and the author explicitly on message create', async () => {
    ticketsService.createMessage.mockResolvedValue({
      id: '019538c4-2f7a-7c31-9c1b-000000000003',
      state: 'WAITING_FEEDBACK',
    });

    await controllerService.createMessage({
      ticket_id,
      account,
      ip,
      body: {
        message: 'looking into it',
        state: 'WAITING_FEEDBACK',
      },
    });

    expect(ticketsService.createMessage).toHaveBeenCalledWith({
      ticket_id,
      account,
      message: 'looking into it',
      state: 'WAITING_FEEDBACK',
    });
  });

  it('should never let a smuggled login_id reach the domain on message create', async () => {
    ticketsService.createMessage.mockResolvedValue({
      id: '019538c4-2f7a-7c31-9c1b-000000000003',
      state: 'IN_PROGRESS',
    });

    await controllerService.createMessage({
      ticket_id,
      account,
      ip,
      body: {
        message: 'looking into it',
        state: 'IN_PROGRESS',
        login_id: '019538c4-2f7a-7c31-9c1b-000000000009',
      } as never,
    });

    const [call] = ticketsService.createMessage.mock.calls;
    expect(call[0]).not.toHaveProperty('login_id');
  });

  it('should omit the state when the message body carries none', async () => {
    ticketsService.createMessage.mockResolvedValue({
      id: '019538c4-2f7a-7c31-9c1b-000000000003',
      state: 'NEW',
    });

    await controllerService.createMessage({
      ticket_id,
      account,
      ip,
      body: { message: 'still down' },
    });

    const [call] = ticketsService.createMessage.mock.calls;
    expect(call[0]).not.toHaveProperty('state');
  });
});
