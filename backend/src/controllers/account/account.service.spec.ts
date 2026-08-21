import {
  AccountService,
  IAccountAreaItemListPromise,
  IAccountCreatePromise,
  IAccountMessageListWithPaginationPromise,
  IAccountTicketListWithPaginationPromise,
} from '@app/account';
import { IAuthenticatedAccount } from '@app/auth';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  IAccountCreateDTO,
  IAccountMessagesListQueryDTO,
  IAccountTicketsListQueryDTO,
  IAuthPutPasswordDTO,
} from './account.dto';
import { AccountControllerService } from './account.service';

describe('AccountControllerService', () => {
  let controllerService: AccountControllerService;

  let log: jest.SpyInstance;
  let accountService: jest.Mocked<AccountService>;
  let jwtService: jest.Mocked<JwtService>;

  const uuid = '019538c4-2f7a-7c31-9c1b-000000000001';

  const account: IAuthenticatedAccount = {
    username: 'admin',
    id: uuid,
    role: 'ADMIN',
  };

  const ip = '127.0.0.1';

  const accountCreateBody: IAccountCreateDTO = {
    username: 'johndoe',
    email: 'johndoe@test.com',
    password: 'test123',
    role: 'MASTER',
  };

  const passwordUpdateBody: IAuthPutPasswordDTO = {
    currentPassword: 'old_pass',
    newPassword: 'new_pass',
  };

  beforeEach(async () => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountControllerService,
        {
          provide: AccountService,
          useValue: {
            createOne: jest.fn(),
            updatePassword: jest.fn(),
            findManyWithPagination: jest.fn(),
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
    jwtService = module.get(JwtService);

    log.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controllerService).toBeDefined();
  });

  describe('login', () => {
    it('should sign the account into a token and return it as access_token', async () => {
      jwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await controllerService.login(account, ip);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        username: account.username,
        role: account.role,
        sub: account.id,
      });
      expect(log).toHaveBeenCalledWith(
        `[login] - LOGINID:${account.id} | IP:${ip} - SIGNIN`,
      );
      expect(result).toEqual({ access_token: 'jwt-token' });
    });

    it('should carry the role into the token so the guard can read it back', async () => {
      jwtService.signAsync.mockResolvedValue('jwt-token');

      await controllerService.login({ ...account, role: 'MASTER' }, ip);

      const [call] = jwtService.signAsync.mock.calls;
      expect((call[0] as { role: string }).role).toBe('MASTER');
    });

    it('should put the account id under sub and never under id', async () => {
      jwtService.signAsync.mockResolvedValue('jwt-token');

      await controllerService.login(account, ip);

      const [call] = jwtService.signAsync.mock.calls;
      expect(call[0]).not.toHaveProperty('id');
      expect((call[0] as { sub: string }).sub).toBe(uuid);
    });

    it('should propagate errors thrown by jwtService.signAsync', async () => {
      const error = new Error('signing failed');
      jwtService.signAsync.mockRejectedValue(error);

      await expect(controllerService.login(account, ip)).rejects.toBe(error);
      expect(log).not.toHaveBeenCalled();
    });
  });

  describe('createOne', () => {
    it('should create the account and return the new id', async () => {
      const expected: IAccountCreatePromise = { id: uuid };
      accountService.createOne.mockResolvedValue(expected);

      const result = await controllerService.createOne({
        account,
        ip,
        body: accountCreateBody,
      });

      expect(accountService.createOne).toHaveBeenCalledTimes(1);
      expect(accountService.createOne).toHaveBeenCalledWith(accountCreateBody);
      expect(log).toHaveBeenCalledWith(
        `[update] - ADMINID:${account.id} | CREATED_LOGINID:${expected.id} | IP:${ip} - USER CREATED`,
      );
      expect(result).toEqual(expected);
    });

    it('should propagate errors thrown by accountService.createOne and not log success', async () => {
      const error = new Error('username already taken');
      accountService.createOne.mockRejectedValue(error);

      await expect(
        controllerService.createOne({ account, ip, body: accountCreateBody }),
      ).rejects.toBe(error);

      expect(accountService.createOne).toHaveBeenCalledWith(accountCreateBody);
      expect(log).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update the password of the authenticated account and return nothing', async () => {
      accountService.updatePassword.mockResolvedValue({ id: uuid });

      const result = await controllerService.update({
        account,
        ip,
        body: passwordUpdateBody,
      });

      expect(accountService.updatePassword).toHaveBeenCalledTimes(1);
      expect(accountService.updatePassword).toHaveBeenCalledWith({
        login_id: account.id,
        current_password: passwordUpdateBody.currentPassword,
        new_password: passwordUpdateBody.newPassword,
      });
      expect(log).toHaveBeenCalledWith(
        `[update] - LOGINID:${uuid} | IP:${ip} - PASSWORD UPDATE`,
      );
      expect(result).toBeUndefined();
    });

    it('should take the target login from the token and never from the body', async () => {
      accountService.updatePassword.mockResolvedValue({ id: uuid });

      await controllerService.update({
        account,
        ip,
        body: {
          ...passwordUpdateBody,
          login_id: '019538c4-2f7a-7c31-9c1b-000000000099',
        } as never,
      });

      const [call] = accountService.updatePassword.mock.calls;
      expect(call[0].login_id).toBe(account.id);
    });

    it('should propagate errors thrown by accountService.updatePassword and not log success', async () => {
      const error = new Error('invalid password');
      accountService.updatePassword.mockRejectedValue(error);

      await expect(
        controllerService.update({ account, ip, body: passwordUpdateBody }),
      ).rejects.toBe(error);

      expect(log).not.toHaveBeenCalled();
    });
  });

  describe('findAllWithPagination', () => {
    it('should flatten the query onto the domain call', async () => {
      const pagination = { data: [], meta: { count: 0 } };
      accountService.findManyWithPagination.mockResolvedValue(
        pagination as never,
      );

      const result = await controllerService.findAllWithPagination({
        per_page: 10,
        sort: '-created_at',
        role: ['ADMIN'],
      });

      expect(accountService.findManyWithPagination).toHaveBeenCalledWith({
        per_page: 10,
        sort: '-created_at',
        role: ['ADMIN'],
      });
      expect(result).toBe(pagination);
    });
  });
});

describe('AccountControllerService (relations endpoints)', () => {
  let controllerService: AccountControllerService;
  let accountService: jest.Mocked<AccountService>;

  const loginId = '019538c4-2f7a-7c31-9c1b-000000000010';

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
