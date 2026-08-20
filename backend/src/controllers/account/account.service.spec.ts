import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  IAccountMessagesListQueryDTO,
  IAccountTicketsListQueryDTO,
  IAuthPutPasswordDTO,
} from './account.dto';
import { AuthenticationControllerService } from './account.service';
import { AccountControllerService } from './account.service';
import { Logger } from '@nestjs/common';
import {
  AccountService,
  IAccountAreaItemListPromise,
  IAccountCreateParams,
  IAccountCreatePromise,
  IAccountMessageListWithPaginationPromise,
  IAccountTicketListWithPaginationPromise,
} from '../../../libs/account/src';
import { IAuthenticatedAccount } from '../../../libs/auth/src';

describe('AuthenticationControllerService', () => {
  let controllerService: AuthenticationControllerService;

  let logger: jest.Mocked<Logger>;
  let accountService: jest.Mocked<AccountService>;
  let jwtService: jest.Mocked<JwtService>;

  const uuid = '00000000-0000-0000-0000-000000000001';

  const user: IAuthenticatedAccount = {
    username: 'admin',
    id: uuid,
  };

  const ip = '127.0.0.1';

  const userCreateBody: IAccountCreateParams = {
    username: 'admin',
    email: 'johndoe@test.com',
    password: 'test123',
    role: 'MASTER',
  };

  const userUpdateBody: IAuthPutPasswordDTO = {
    currentPassword: 'old_pass',
    newPassword: 'new_pass',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationControllerService,
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: AccountService,
          useValue: {
            createOne: jest.fn(),
            updatePassword: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    controllerService = module.get<AuthenticationControllerService>(
      AuthenticationControllerService,
    );

    logger = module.get(Logger);
    accountService = module.get(AccountService);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(controllerService).toBeDefined();
  });

  describe('login', () => {
    it('should login and return the JWT in access_token', async () => {
      jwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await controllerService.login({
        user,
        ip,
      });

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        username: user.username,
        sub: user.loginId,
      });

      expect(logger.log).toHaveBeenCalled();

      expect(result).toEqual({
        access_token: 'jwt-token',
      });
    });
  });

  describe('register', () => {
    it('should create a new user and return the uuid', async () => {
      const expected: IAccountCreatePromise = { id: uuid };
      accountService.createOne.mockResolvedValue(expected);

      const result = await controllerService.createOne({
        account,
        ip,
        body: userCreateBody,
      });

      expect(accountService.createOne).toHaveBeenCalledTimes(1);
      expect(accountService.createOne).toHaveBeenCalledWith(userCreateBody);

      expect(logger.log).toHaveBeenCalledWith(
        `[update] - ADMINID:${user.id} | CREATED_LOGINID:${expected.id} | IP:${ip} - USER CREATED`,
        AuthenticationControllerService.name,
      );

      expect(result).toEqual(expected);
    });

    it('should propagate errors thrown by accountService.createOne and not log success', async () => {
      const error = new Error('username already taken');
      accountService.createOne.mockRejectedValue(error);

      await expect(
        controllerService.createOne({ account, ip, body: userCreateBody }),
      ).rejects.toBe(error);

      expect(accountService.createOne).toHaveBeenCalledWith(userCreateBody);
      expect(logger.log).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update user password', async () => {
      const expected: ILoginUpdatePasswordPromise = {
        id: uuid,
      };

      accountService.updatePassword.mockResolvedValue(expected);

      const result = await controllerService.update({
        user,
        ip,
        body: userUpdateBody,
      });

      expect(accountService.updatePassword).toHaveBeenCalledTimes(1);
      expect(accountService.updatePassword).toHaveBeenCalledWith({
        loginId: user.loginId,
        currentPassword: userUpdateBody.currentPassword,
        newPassword: userUpdateBody.newPassword,
      });

      expect(logger.log).toHaveBeenCalledWith(
        `[update] - LOGINID:${expected.id} | IP:${ip} - PASSWORD UPDATE`,
        AuthenticationControllerService.name,
      );

      expect(result).toBeUndefined();
    });

    it('should propagate errors thrown by accountService.updatePassword and not log success', async () => {
      const error = new Error('invalid password');
      accountService.updatePassword.mockRejectedValue(error);

      await expect(
        controllerService.update({ user, ip, body: userUpdateBody }),
      ).rejects.toBe(error);

      expect(accountService.updatePassword).toHaveBeenCalledWith({
        loginId: user.loginId,
        ...userUpdateBody,
      });
      expect(logger.log).not.toHaveBeenCalled();
    });
  });
});

describe('AccountControllerService (relations endpoints)', () => {
  let controllerService: AccountControllerService;
  let accountService: jest.Mocked<AccountService>;

  const loginId = '00000000-0000-0000-0000-000000000010';

  const ticketsQuery: IAccountTicketsListQueryDTO = {
    relation: 'requester',
    per_page: 10,
    offset: 0,
    sort: 'created_at',
  };

  const messagesQuery: IAccountMessagesListQueryDTO = {
    per_page: 10,
    offset: 0,
    sort: 'created_at',
  };

  const paginatedTickets: IAccountTicketListWithPaginationPromise = {
    data: [],
    meta: {
      count: 0,
      totalOfPages: 0,
      first: { page: 1, offset: 0, isCurrent: true },
      last: { page: 1, offset: 0, isCurrent: true },
      previous: { page: 1, offset: 0, isCurrent: true },
      around: [],
      next: { page: 1, offset: 0, isCurrent: true },
    },
  };

  const paginatedMessages: IAccountMessageListWithPaginationPromise = {
    ...paginatedTickets,
    data: [],
  };

  const areas: IAccountAreaItemListPromise[] = [];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountControllerService,
        {
          provide: AccountService,
          useValue: {
            findTicketsWithPagination: jest.fn(),
            findMessagesWithPagination: jest.fn(),
            findAssignedAreas: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    controllerService = module.get<AccountControllerService>(
      AccountControllerService,
    );
    accountService = module.get(AccountService);
  });

  describe('findTicketsWithPagination', () => {
    it('should delegate to accountService with the login_id and the flattened query', async () => {
      accountService.findTicketsWithPagination.mockResolvedValue(
        paginatedTickets,
      );

      const result = await controllerService.findTicketsWithPagination({
        login_id: loginId,
        query: ticketsQuery,
      });

      expect(accountService.findTicketsWithPagination).toHaveBeenCalledWith({
        login_id: loginId,
        ...ticketsQuery,
      });
      expect(result).toBe(paginatedTickets);
    });

    it('should propagate errors thrown by accountService.findTicketsWithPagination', async () => {
      const error = new Error('tickets failed');
      accountService.findTicketsWithPagination.mockRejectedValue(error);

      await expect(
        controllerService.findTicketsWithPagination({
          login_id: loginId,
          query: ticketsQuery,
        }),
      ).rejects.toBe(error);
    });
  });

  describe('findMessagesWithPagination', () => {
    it('should delegate to accountService with the login_id and the flattened query', async () => {
      accountService.findMessagesWithPagination.mockResolvedValue(
        paginatedMessages,
      );

      const result = await controllerService.findMessagesWithPagination({
        login_id: loginId,
        query: messagesQuery,
      });

      expect(accountService.findMessagesWithPagination).toHaveBeenCalledWith({
        login_id: loginId,
        ...messagesQuery,
      });
      expect(result).toBe(paginatedMessages);
    });

    it('should propagate errors thrown by accountService.findMessagesWithPagination', async () => {
      const error = new Error('messages failed');
      accountService.findMessagesWithPagination.mockRejectedValue(error);

      await expect(
        controllerService.findMessagesWithPagination({
          login_id: loginId,
          query: messagesQuery,
        }),
      ).rejects.toBe(error);
    });
  });

  describe('findAssignedAreas', () => {
    it('should delegate to accountService with the login_id', async () => {
      accountService.findAssignedAreas.mockResolvedValue(areas);

      const result = await controllerService.findAssignedAreas({
        login_id: loginId,
      });

      expect(accountService.findAssignedAreas).toHaveBeenCalledWith(loginId);
      expect(result).toBe(areas);
    });

    it('should propagate errors thrown by accountService.findAssignedAreas', async () => {
      const error = new Error('areas failed');
      accountService.findAssignedAreas.mockRejectedValue(error);

      await expect(
        controllerService.findAssignedAreas({ login_id: loginId }),
      ).rejects.toBe(error);
    });
  });
});
