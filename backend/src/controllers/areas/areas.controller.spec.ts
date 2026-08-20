import type { IAuthenticatedAccount } from '@app/auth';
import { Test, TestingModule } from '@nestjs/testing';
import { AreasController } from './areas.controller';
import { AreasControllerService } from './areas.service';

describe('AreasController', () => {
  let controller: AreasController;
  let controllerService: jest.Mocked<AreasControllerService>;

  const account: IAuthenticatedAccount = {
    username: 'admin',
    id: '019538c4-2f7a-7c31-9c1b-000000000001',
    role: 'MASTER',
  };
  const area_id = '019538c4-2f7a-7c31-9c1b-000000000002';
  const ip = '127.0.0.1';

  beforeEach(async () => {
    const serviceMock = {
      findAllWithPagination: jest.fn(),
      findAccounts: jest.fn(),
      findTicketsWithPagination: jest.fn(),
      createOne: jest.fn(),
      updateOneById: jest.fn(),
    } as unknown as jest.Mocked<AreasControllerService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AreasController],
      providers: [{ provide: AreasControllerService, useValue: serviceMock }],
    }).compile();

    controller = module.get(AreasController);
    controllerService = module.get(AreasControllerService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('should delegate the query to the controller service', async () => {
      const query = { per_page: 10, sort: 'alias' };
      const expected = { data: [], meta: {} } as never;

      controllerService.findAllWithPagination.mockResolvedValue(expected);

      const result = await controller.list(query);

      expect(controllerService.findAllWithPagination).toHaveBeenCalledWith(
        query,
      );
      expect(result).toBe(expected);
    });

    it('should propagate errors thrown by the controller service', async () => {
      const error = new Error('service');

      controllerService.findAllWithPagination.mockRejectedValue(error);

      await expect(
        controller.list({ per_page: 10, sort: 'alias' }),
      ).rejects.toBe(error);
    });
  });

  describe('accounts', () => {
    it('should pass the id param as area_id', async () => {
      controllerService.findAccounts.mockResolvedValue([]);

      await controller.accounts({ id: area_id }, { sort: 'username' });

      expect(controllerService.findAccounts).toHaveBeenCalledWith({
        area_id,
        query: { sort: 'username' },
      });
    });
  });

  describe('tickets', () => {
    it('should pass the id param as area_id', async () => {
      const expected = { data: [], meta: {} } as never;
      const query = { per_page: 10, sort: 'created_at' };

      controllerService.findTicketsWithPagination.mockResolvedValue(expected);

      const result = await controller.tickets({ id: area_id }, query);

      expect(controllerService.findTicketsWithPagination).toHaveBeenCalledWith({
        area_id,
        query,
      });
      expect(result).toBe(expected);
    });
  });

  describe('create', () => {
    const body = {
      alias: 'Support',
      description: 'First line support',
      logins: ['019538c4-2f7a-7c31-9c1b-000000000003'],
    };

    it('should return the created id', async () => {
      controllerService.createOne.mockResolvedValue({ id: area_id });

      const result = await controller.create(account, ip, body);

      expect(controllerService.createOne).toHaveBeenCalledWith({
        body,
        ip,
        account,
      });
      expect(result).toEqual({ id: area_id });
    });

    it('should propagate errors thrown by the controller service', async () => {
      const error = new Error('service');

      controllerService.createOne.mockRejectedValue(error);

      await expect(controller.create(account, ip, body)).rejects.toBe(error);
    });
  });

  describe('update', () => {
    it('should pass the id param, the body, the ip and the account', async () => {
      const body = { alias: 'Renamed' };

      controllerService.updateOneById.mockResolvedValue({ id: area_id });

      const result = await controller.update(
        account,
        ip,
        { id: area_id },
        body,
      );

      expect(controllerService.updateOneById).toHaveBeenCalledWith({
        id: area_id,
        body,
        ip,
        account,
      });
      expect(result).toEqual({ id: area_id });
    });
  });
});
