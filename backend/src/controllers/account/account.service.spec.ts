import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  IAccountMessagesListQueryDTO,
  IAccountTicketsListQueryDTO,
  IAuthPutPasswordDTO,
} from './account.dto';
import { AuthenticationControllerService } from './account.service';
import { AccountControllerService } from './account.service';
import { ForbiddenException, Logger } from '@nestjs/common';
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

  const ownerId = '00000000-0000-0000-0000-000000000010';
  const strangerId = '00000000-0000-0000-0000-000000000020';

  const ownerAccount: IAuthenticatedAccount = {
    id: ownerId,
    username: 'owner',
    role: 'USER',
  };
  const adminAccount: IAuthenticatedAccount = {
    id: '00000000-0000-0000-0000-000000000099',
    username: 'admin',
    role: 'ADMIN',
  };
  const masterAccount: IAuthenticatedAccount = {
    id: '00000000-0000-0000-0000-000000000098',
    username: 'master',
    role: 'MASTER',
  };
  const strangerAccount: IAuthenticatedAccount = {
    id: strangerId,
    username: 'stranger',
    role: 'USER',
  };

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

  describe('access scope', () => {
    it('allows the owner to read their own tickets', async () => {
      accountService.findTicketsWithPagination.mockResolvedValue(
        paginatedTickets,
      );

      await expect(
        controllerService.findTicketsWithPagination({
          account: ownerAccount,
          login_id: ownerId,
          query: ticketsQuery,
        }),
      ).resolves.toEqual(paginatedTickets);
    });

    it('allows ADMIN to read another account tickets', async () => {
      accountService.findTicketsWithPagination.mockResolvedValue(
        paginatedTickets,
      );

      await expect(
        controllerService.findTicketsWithPagination({
          account: adminAccount,
          login_id: ownerId,
          query: ticketsQuery,
        }),
      ).resolves.toEqual(paginatedTickets);
    });

    it('allows MASTER to read another account tickets', async () => {
      accountService.findTicketsWithPagination.mockResolvedValue(
        paginatedTickets,
      );

      await expect(
        controllerService.findTicketsWithPagination({
          account: masterAccount,
          login_id: ownerId,
          query: ticketsQuery,
        }),
      ).resolves.toEqual(paginatedTickets);
    });

    it('rejects a different USER with ForbiddenException', async () => {
      await expect(
        controllerService.findTicketsWithPagination({
          account: strangerAccount,
          login_id: ownerId,
          query: ticketsQuery,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(accountService.findTicketsWithPagination).not.toHaveBeenCalled();
    });
  });

  describe('findTicketsWithPagination', () => {
    it('delegates to accountService.findTicketsWithPagination with login_id and query', async () => {
      accountService.findTicketsWithPagination.mockResolvedValue(
        paginatedTickets,
      );

      const result = await controllerService.findTicketsWithPagination({
        account: ownerAccount,
        login_id: ownerId,
        query: ticketsQuery,
      });

      expect(accountService.findTicketsWithPagination).toHaveBeenCalledWith({
        login_id: ownerId,
        ...ticketsQuery,
      });
      expect(result).toBe(paginatedTickets);
    });
  });

  describe('findMessagesWithPagination', () => {
    it('delegates to accountService.findMessagesWithPagination with login_id and query', async () => {
      accountService.findMessagesWithPagination.mockResolvedValue(
        paginatedMessages,
      );

      const result = await controllerService.findMessagesWithPagination({
        account: ownerAccount,
        login_id: ownerId,
        query: messagesQuery,
      });

      expect(accountService.findMessagesWithPagination).toHaveBeenCalledWith({
        login_id: ownerId,
        ...messagesQuery,
      });
      expect(result).toBe(paginatedMessages);
    });

    it('rejects a different USER with ForbiddenException', async () => {
      await expect(
        controllerService.findMessagesWithPagination({
          account: strangerAccount,
          login_id: ownerId,
          query: messagesQuery,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(accountService.findMessagesWithPagination).not.toHaveBeenCalled();
    });
  });

  describe('findAssignedAreas', () => {
    it('delegates to accountService.findAssignedAreas with login_id', async () => {
      accountService.findAssignedAreas.mockResolvedValue(areas);

      const result = await controllerService.findAssignedAreas({
        account: ownerAccount,
        login_id: ownerId,
      });

      expect(accountService.findAssignedAreas).toHaveBeenCalledWith(ownerId);
      expect(result).toBe(areas);
    });

    it('rejects a different USER with ForbiddenException', async () => {
      await expect(
        controllerService.findAssignedAreas({
          account: strangerAccount,
          login_id: ownerId,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(accountService.findAssignedAreas).not.toHaveBeenCalled();
    });
  });
});
