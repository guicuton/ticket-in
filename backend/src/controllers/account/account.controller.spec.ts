import type {
  IAccountAreaItemListPromise,
  IAccountMessageListWithPaginationPromise,
  IAccountTicketListWithPaginationPromise,
} from '@app/account';
import type { IAuthenticatedAccount } from '@app/auth';
import { LOGIN_ROLES } from '@app/database';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountController } from './account.controller';
import {
  IAccountIdParamDTO,
  IAccountMessagesListQueryDTO,
  IAccountTicketsListQueryDTO,
  IAuthCreateDTO,
  IAuthPutPasswordDTO,
} from './account.dto';
import {
  IAuthLoginCreatePromise,
  IAuthLoginPromise,
} from './account.interface';
import { AccountControllerService } from './account.service';

describe('AccountController', () => {
  let controller: AccountController;
  let controllerService: jest.Mocked<AccountControllerService>;

  const user: IAuthenticatedAccount = {
    username: 'admin',
    id: '00000000-0000-0000-0000-000000000001',
    role: 'MASTER',
  };
  const ip = '127.0.0.1';

  beforeEach(async () => {
    const serviceMock: jest.Mocked<AccountControllerService> = {
      login: jest.fn(),
      createOne: jest.fn(),
      update: jest.fn(),
      findTicketsWithPagination: jest.fn(),
      findMessagesWithPagination: jest.fn(),
      findAssignedAreas: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountController],
      providers: [
        {
          provide: AccountControllerService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AccountController>(AccountController);
    controllerService = module.get<jest.Mocked<AccountControllerService>>(
      AccountControllerService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should successfully login by controllerService.login and return the jwt token', async () => {
      const expected: IAuthLoginPromise = { access_token: 'jwt-token' };
      controllerService.login.mockResolvedValue(expected);

      const result = await controller.login(user, ip);

      expect(controllerService.login).toHaveBeenCalledTimes(1);
      expect(controllerService.login).toHaveBeenCalledWith({ user, ip });

      expect(result).toEqual(expected);
    });

    it('should propagate errors thrown by controllerService.login', async () => {
      const error = new Error('login failed');
      controllerService.login.mockRejectedValue(error);

      await expect(controller.login(user, ip)).rejects.toBe(error);
      expect(controllerService.login).toHaveBeenCalledWith({ user, ip });
    });
  });

  describe('register', () => {
    const body: IAuthCreateDTO = {
      username: 'johndoe',
      password: 'NewPass_1',
      email: 'john@doe.com',
    };

    it('should return the uuid of new registered user by controllerService.createOne', async () => {
      const expected: IAuthLoginCreatePromise = {
        id: '00000000-0000-0000-0000-000000000099',
      };
      controllerService.createOne.mockResolvedValue(expected);

      const result = await controller.register(user, ip, body);

      expect(controllerService.createOne).toHaveBeenCalledTimes(1);
      expect(controllerService.createOne).toHaveBeenCalledWith({
        body,
        ip,
        user,
      });
      expect(result).toBe(expected);
    });

    it('should propagate errors thrown by controllerService.createOne', async () => {
      const error = new Error('create failed');
      controllerService.createOne.mockRejectedValue(error);

      await expect(controller.register(user, ip, body)).rejects.toBe(error);
      expect(controllerService.createOne).toHaveBeenCalledWith({
        body,
        ip,
        user,
      });
    });
  });

  describe('update', () => {
    const body: IAuthPutPasswordDTO = {
      currentPassword: 'OldPass_1',
      newPassword: 'NewPass_1',
    };

    it('should return http 200 when successfully update user pass by controllerService.update', async () => {
      controllerService.update.mockResolvedValue(undefined);

      const result = await controller.update(user, ip, body);

      expect(controllerService.update).toHaveBeenCalledTimes(1);
      expect(controllerService.update).toHaveBeenCalledWith({
        body,
        ip,
        user,
      });
      expect(result).toBeUndefined();
    });

    it('should propagate errors thrown by controllerService.update', async () => {
      const error = new Error('update failed');
      controllerService.update.mockRejectedValue(error);

      await expect(controller.update(user, ip, body)).rejects.toBe(error);
      expect(controllerService.update).toHaveBeenCalledWith({
        body,
        ip,
        user,
      });
    });
  });

  describe('tickets', () => {
    const query: IAccountTicketsListQueryDTO = {
      relation: 'requester',
      per_page: 10,
      offset: 0,
      sort: 'created_at',
    };

    it('should return the authenticated account tickets by controllerService.findTicketsWithPagination', async () => {
      const expected = {
        data: [],
        meta: {},
      } as unknown as IAccountTicketListWithPaginationPromise;
      controllerService.findTicketsWithPagination.mockResolvedValue(expected);

      const result = await controller.tickets(user, query);

      expect(controllerService.findTicketsWithPagination).toHaveBeenCalledTimes(
        1,
      );
      expect(controllerService.findTicketsWithPagination).toHaveBeenCalledWith({
        login_id: user.id,
        query,
      });
      expect(result).toBe(expected);
    });

    it('should read the authenticated account id and never a value from the request', async () => {
      controllerService.findTicketsWithPagination.mockResolvedValue(
        {} as IAccountTicketListWithPaginationPromise,
      );

      await controller.tickets(user, query);

      const [call] = controllerService.findTicketsWithPagination.mock.calls[0];
      expect(call.login_id).toBe(user.id);
    });

    it('should propagate errors thrown by controllerService.findTicketsWithPagination', async () => {
      const error = new Error('tickets failed');
      controllerService.findTicketsWithPagination.mockRejectedValue(error);

      await expect(controller.tickets(user, query)).rejects.toBe(error);
    });
  });

  describe('ticketsById', () => {
    const params: IAccountIdParamDTO = {
      id: '00000000-0000-0000-0000-000000000010',
    };
    const query: IAccountTicketsListQueryDTO = {
      relation: 'requester',
      per_page: 10,
      offset: 0,
      sort: 'created_at',
    };

    it('should return the given account tickets by controllerService.findTicketsWithPagination', async () => {
      const expected = {
        data: [],
        meta: {},
      } as unknown as IAccountTicketListWithPaginationPromise;
      controllerService.findTicketsWithPagination.mockResolvedValue(expected);

      const result = await controller.ticketsById(params, query);

      expect(controllerService.findTicketsWithPagination).toHaveBeenCalledWith({
        login_id: params.id,
        query,
      });
      expect(result).toBe(expected);
    });

    it('should propagate errors thrown by controllerService.findTicketsWithPagination', async () => {
      const error = new Error('tickets failed');
      controllerService.findTicketsWithPagination.mockRejectedValue(error);

      await expect(controller.ticketsById(params, query)).rejects.toBe(error);
    });
  });

  describe('messages', () => {
    const query: IAccountMessagesListQueryDTO = {
      per_page: 10,
      offset: 0,
      sort: 'created_at',
    };

    it('should return the authenticated account messages by controllerService.findMessagesWithPagination', async () => {
      const expected = {
        data: [],
        meta: {},
      } as unknown as IAccountMessageListWithPaginationPromise;
      controllerService.findMessagesWithPagination.mockResolvedValue(expected);

      const result = await controller.messages(user, query);

      expect(controllerService.findMessagesWithPagination).toHaveBeenCalledWith(
        {
          login_id: user.id,
          query,
        },
      );
      expect(result).toBe(expected);
    });

    it('should propagate errors thrown by controllerService.findMessagesWithPagination', async () => {
      const error = new Error('messages failed');
      controllerService.findMessagesWithPagination.mockRejectedValue(error);

      await expect(controller.messages(user, query)).rejects.toBe(error);
    });
  });

  describe('messagesById', () => {
    const params: IAccountIdParamDTO = {
      id: '00000000-0000-0000-0000-000000000010',
    };
    const query: IAccountMessagesListQueryDTO = {
      per_page: 10,
      offset: 0,
      sort: 'created_at',
    };

    it('should return the given account messages by controllerService.findMessagesWithPagination', async () => {
      const expected = {
        data: [],
        meta: {},
      } as unknown as IAccountMessageListWithPaginationPromise;
      controllerService.findMessagesWithPagination.mockResolvedValue(expected);

      const result = await controller.messagesById(params, query);

      expect(controllerService.findMessagesWithPagination).toHaveBeenCalledWith(
        {
          login_id: params.id,
          query,
        },
      );
      expect(result).toBe(expected);
    });

    it('should propagate errors thrown by controllerService.findMessagesWithPagination', async () => {
      const error = new Error('messages failed');
      controllerService.findMessagesWithPagination.mockRejectedValue(error);

      await expect(controller.messagesById(params, query)).rejects.toBe(error);
    });
  });

  describe('areas', () => {
    it('should return the authenticated account assigned areas by controllerService.findAssignedAreas', async () => {
      const expected: IAccountAreaItemListPromise[] = [];
      controllerService.findAssignedAreas.mockResolvedValue(expected);

      const result = await controller.areas(user);

      expect(controllerService.findAssignedAreas).toHaveBeenCalledWith({
        login_id: user.id,
      });
      expect(result).toBe(expected);
    });

    it('should propagate errors thrown by controllerService.findAssignedAreas', async () => {
      const error = new Error('areas failed');
      controllerService.findAssignedAreas.mockRejectedValue(error);

      await expect(controller.areas(user)).rejects.toBe(error);
    });
  });

  describe('areasById', () => {
    const params: IAccountIdParamDTO = {
      id: '00000000-0000-0000-0000-000000000010',
    };

    it('should return the given account assigned areas by controllerService.findAssignedAreas', async () => {
      const expected: IAccountAreaItemListPromise[] = [];
      controllerService.findAssignedAreas.mockResolvedValue(expected);

      const result = await controller.areasById(params);

      expect(controllerService.findAssignedAreas).toHaveBeenCalledWith({
        login_id: params.id,
      });
      expect(result).toBe(expected);
    });

    it('should propagate errors thrown by controllerService.findAssignedAreas', async () => {
      const error = new Error('areas failed');
      controllerService.findAssignedAreas.mockRejectedValue(error);

      await expect(controller.areasById(params)).rejects.toBe(error);
    });
  });

  describe('roles metadata', () => {
    const reflector = new Reflector();

    it.each([
      ['ticketsById', AccountController.prototype.ticketsById],
      ['messagesById', AccountController.prototype.messagesById],
      ['areasById', AccountController.prototype.areasById],
    ])('should restrict %s to ADMIN and MASTER', (_name, handler) => {
      expect(reflector.get<string[]>('roles', handler)).toEqual([
        LOGIN_ROLES.ADMIN,
        LOGIN_ROLES.MASTER,
      ]);
    });

    it.each([
      ['tickets', AccountController.prototype.tickets],
      ['messages', AccountController.prototype.messages],
      ['areas', AccountController.prototype.areas],
    ])(
      'should leave %s reachable by any authenticated account',
      (_name, handler) => {
        expect(reflector.get<string[]>('roles', handler)).toBeUndefined();
      },
    );
  });
});
