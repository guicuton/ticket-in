import { RequestMethod } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsControllerService } from './tickets.service';

describe('TicketsController', () => {
  let controller: TicketsController;
  let controllerService: jest.Mocked<TicketsControllerService>;

  const ticket_id = '019538c4-2f7a-7c31-9c1b-000000000001';
  const account = {
    id: '019538c4-2f7a-7c31-9c1b-000000000002',
    username: 'admin',
    role: 'ADMIN' as const,
  };
  const ip = '127.0.0.1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsControllerService,
          useValue: {
            findAllWithPagination: jest.fn(),
            findOneById: jest.fn(),
            findMessages: jest.fn(),
            createOne: jest.fn(),
            createMessage: jest.fn(),
            updateOneById: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(TicketsController);
    controllerService = module.get(TicketsControllerService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should hand the account and query to the list', async () => {
    const query = { per_page: 10, sort: '-created_at' };
    await controller.list(account, query as never);

    expect(controllerService.findAllWithPagination).toHaveBeenCalledWith({
      account,
      query,
    });
  });

  it('should map the id param to ticket_id on the detail', async () => {
    await controller.detail(account, { id: ticket_id });

    expect(controllerService.findOneById).toHaveBeenCalledWith({
      ticket_id,
      account,
    });
  });

  it('should map the id param to ticket_id on the message thread', async () => {
    await controller.messages(account, { id: ticket_id });

    expect(controllerService.findMessages).toHaveBeenCalledWith({
      ticket_id,
      account,
    });
  });

  it('should forward the create body with the ip and account', async () => {
    const body = { subject: 'Printer is down', description: 'No response' };
    await controller.create(account, ip, body);

    expect(controllerService.createOne).toHaveBeenCalledWith({
      body,
      ip,
      account,
    });
  });

  it('should forward the update body with the id', async () => {
    const body = { state: 'RESOLVED' as const };
    await controller.update(account, ip, { id: ticket_id }, body);

    expect(controllerService.updateOneById).toHaveBeenCalledWith({
      id: ticket_id,
      body,
      ip,
      account,
    });
  });

  it('should map the id param and the body on message create', async () => {
    const body = { message: 'still down' };
    await controller.createMessage(account, ip, { id: ticket_id }, body);

    expect(controllerService.createMessage).toHaveBeenCalledWith({
      ticket_id,
      body,
      ip,
      account,
    });
  });

  describe('route wiring', () => {
    it('should nest the message create under the ticket id as a POST', () => {
      expect(
        Reflect.getMetadata('path', TicketsController.prototype.createMessage),
      ).toBe(':id/messages/create');
      expect(
        Reflect.getMetadata(
          'method',
          TicketsController.prototype.createMessage,
        ),
      ).toBe(RequestMethod.POST);
    });

    it('should leave the message create open to every role, scoped by the ticket', () => {
      expect(
        Reflect.getMetadata('roles', TicketsController.prototype.createMessage),
      ).toBeUndefined();
    });

    it('should keep the ticket update pinned to ADMIN and MASTER', () => {
      expect(
        Reflect.getMetadata('roles', TicketsController.prototype.update),
      ).toEqual(['ADMIN', 'MASTER']);
    });
  });
});
