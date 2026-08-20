import { CacheModuleServices } from '@app/cache';
import {
  LoginRepository,
  LoginsRepository,
  TICKET_RELATIONS,
  TicketMessagesRepository,
  TicketsRepository,
} from '@app/database';
import {
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { CACHE_TTL } from '../../../configuration/constants';
import { CACHE_TTL as DEFAULT_TTL } from '../../../configuration/constants';
import { AccountService } from './account.service';

jest.mock('bcrypt', () => ({
  hashSync: jest.fn(),
  compareSync: jest.fn(),
}));

const hashSyncMock = bcrypt.hashSync as jest.Mock;
const compareSyncMock = bcrypt.compareSync as jest.Mock;

describe('AccountService', () => {
  let service: AccountService;
  let cache: jest.Mocked<CacheModuleServices>;
  let repository: jest.Mocked<LoginRepository>;

  const uuid = '019538c4-2f7a-7c31-9c1b-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: CacheModuleServices,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            deleteCollection: jest.fn(),
          },
        },
        {
          provide: LoginRepository,
          useValue: {
            createOne: jest.fn(),
            findOneById: jest.fn(),
            findOneByAccountnameOrEmail: jest.fn(),
            updatePasswordById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AccountService);
    cache = module.get(CacheModuleServices);
    repository = module.get(LoginRepository);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOne', () => {
    const params = {
      username: 'admin',
      password: 'plain',
      email: 'a@b.com',
    };

    it('should hash the password and call repository.createOne with the hashed value', async () => {
      hashSyncMock.mockReturnValue('hash');
      repository.createOne.mockResolvedValue({ id: uuid });

      const result = await service.createOne(params);

      expect(hashSyncMock).toHaveBeenCalledWith('plain', 10);
      expect(repository.createOne).toHaveBeenCalledWith({
        username: params.username,
        email: params.email,
        password: 'hash',
        created_at: expect.any(Date),
      });
      expect(result).toEqual({ id: uuid });
    });

    it('should throw UnauthorizedException when repository returns nothing', async () => {
      hashSyncMock.mockReturnValue('hash');
      repository.createOne.mockResolvedValue(undefined);

      await expect(service.createOne(params)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('updatePassword', () => {
    const params = {
      loginId: uuid,
      currentPassword: 'old',
      newPassword: 'new',
    };

    it('should validate current password, hash new one, persist it and clear auth cache', async () => {
      repository.findOneById.mockResolvedValue({
        id: uuid,
        password: 'old-hash',
      });
      compareSyncMock.mockReturnValue(true);
      hashSyncMock.mockReturnValue('new-hash');
      repository.updatePasswordById.mockResolvedValue({ id: uuid });

      const result = await service.updatePassword(params);

      expect(repository.findOneById).toHaveBeenCalledWith(uuid);
      expect(compareSyncMock).toHaveBeenCalledWith('old', 'old-hash');
      expect(hashSyncMock).toHaveBeenCalledWith('new', 10);
      expect(repository.updatePasswordById).toHaveBeenCalledWith({
        loginId: uuid,
        passwordHash: 'new-hash',
      });
      expect(cache.deleteCollection).toHaveBeenCalledWith('auth:*');
      expect(result).toEqual({ id: uuid });
    });

    it('should throw UnauthorizedException when the login is not found', async () => {
      repository.findOneById.mockResolvedValue(undefined);

      await expect(service.updatePassword(params)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repository.updatePasswordById).not.toHaveBeenCalled();
      expect(cache.deleteCollection).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when the current password is wrong', async () => {
      repository.findOneById.mockResolvedValue({
        id: uuid,
        password: 'old-hash',
      });

      await expect(service.updatePassword(params)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repository.updatePasswordById).not.toHaveBeenCalled();
      expect(cache.deleteCollection).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when the update fails', async () => {
      repository.findOneById.mockResolvedValue({
        id: uuid,
        password: 'old-hash',
      });
      compareSyncMock.mockReturnValue(true);
      hashSyncMock.mockReturnValue('new-hash');
      repository.updatePasswordById.mockResolvedValue(undefined);

      await expect(service.updatePassword(params)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(cache.deleteCollection).not.toHaveBeenCalled();
    });
  });

  describe('validateLogin', () => {
    const params = { username: 'admin' };

    it('should return the cached value when present and skip the repository', async () => {
      const cached = { id: uuid, password: 'hash' };
      cache.get.mockResolvedValue(cached);

      const result = await service.validateLogin(params);

      expect(cache.get).toHaveBeenCalledWith({ key: 'auth', item: 'admin' });
      expect(repository.findOneByAccountnameOrEmail).not.toHaveBeenCalled();
      expect(result).toBe(cached);
    });

    it('should query the repository, store the result in cache and return it on cache miss', async () => {
      cache.get.mockResolvedValue(undefined);
      const repoResult = { id: uuid, password: 'hash' };
      repository.findOneByAccountnameOrEmail.mockResolvedValue(repoResult);

      const result = await service.validateLogin(params);

      expect(repository.findOneByAccountnameOrEmail).toHaveBeenCalledWith(
        params,
      );
      expect(cache.set).toHaveBeenCalledWith({
        key: 'auth',
        item: 'admin',
        data: repoResult,
        ttl: DEFAULT_TTL.five,
      });
      expect(result).toBe(repoResult);
    });

    it('should throw UnauthorizedException when the repository finds nothing', async () => {
      cache.get.mockResolvedValue(undefined);
      repository.findOneByAccountnameOrEmail.mockResolvedValue(undefined);

      await expect(service.validateLogin(params)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(cache.set).not.toHaveBeenCalled();
    });
  });

  describe('validatePassword', () => {
    it('should delegate to bcrypt.compareSync', () => {
      compareSyncMock.mockReturnValue(true);

      const result = service.validatePassword({
        userPassword: 'plain',
        hashPassword: 'hash',
      });

      expect(compareSyncMock).toHaveBeenCalledWith('plain', 'hash');
      expect(result).toBe(true);
    });
  });
});

describe('AccountService - tickets, messages and areas', () => {
  let service: AccountService;
  let cache: jest.Mocked<CacheModuleServices>;
  let loginsRepository: jest.Mocked<LoginsRepository>;
  let ticketsRepository: jest.Mocked<TicketsRepository>;
  let ticketMessagesRepository: jest.Mocked<TicketMessagesRepository>;

  const loginId = '019538c4-2f7a-7c31-9c1b-000000000002';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: CacheModuleServices,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            deleteCollection: jest.fn(),
          },
        },
        {
          provide: LoginsRepository,
          useValue: {
            createOne: jest.fn(),
            findOneById: jest.fn(),
            findOneByUsernameOrEmail: jest.fn(),
            updatePasswordById: jest.fn(),
            findManyWithPagination: jest.fn(),
            findAssignedAreasById: jest.fn(),
          },
        },
        {
          provide: TicketsRepository,
          useValue: {
            findManyWithPagination: jest.fn(),
          },
        },
        {
          provide: TicketMessagesRepository,
          useValue: {
            findManyWithPagination: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AccountService);
    cache = module.get(CacheModuleServices);
    loginsRepository = module.get(LoginsRepository);
    ticketsRepository = module.get(TicketsRepository);
    ticketMessagesRepository = module.get(TicketMessagesRepository);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('findTicketsWithPagination', () => {
    const paginationResult = {
      data: [{ id: 'ticket-1' }],
      meta: { count: 1 },
    };

    it('should query by requester_login_id and parse the sort when relation is requester', async () => {
      ticketsRepository.findManyWithPagination.mockResolvedValue(
        paginationResult as never,
      );

      const result = await service.findTicketsWithPagination({
        login_id: loginId,
        relation: TICKET_RELATIONS.requester,
        per_page: 10,
        sort: '-created_at',
      });

      expect(ticketsRepository.findManyWithPagination).toHaveBeenCalledWith({
        offset: undefined,
        per_page: 10,
        sort: { column: 'created_at', direction: 'desc' },
        where: { requester_login_id: loginId },
      });
      expect(result).toBe(paginationResult);
    });

    it('should query by responser_login_id when relation is responser', async () => {
      ticketsRepository.findManyWithPagination.mockResolvedValue(
        paginationResult as never,
      );

      await service.findTicketsWithPagination({
        login_id: loginId,
        relation: TICKET_RELATIONS.responser,
        per_page: 10,
        offset: 5,
        sort: 'created_at',
      });

      expect(ticketsRepository.findManyWithPagination).toHaveBeenCalledWith({
        offset: 5,
        per_page: 10,
        sort: { column: 'created_at', direction: 'asc' },
        where: { responser_login_id: loginId },
      });
    });

    it('should throw UnprocessableEntityException when the repository returns a falsy value', async () => {
      ticketsRepository.findManyWithPagination.mockResolvedValue(undefined);

      await expect(
        service.findTicketsWithPagination({
          login_id: loginId,
          relation: TICKET_RELATIONS.requester,
          per_page: 10,
          sort: 'created_at',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('findMessagesWithPagination', () => {
    const paginationResult = {
      data: [{ id: 'message-1' }],
      meta: { count: 1 },
    };

    it('should query by login_id, parse the sort and return the repository result', async () => {
      ticketMessagesRepository.findManyWithPagination.mockResolvedValue(
        paginationResult as never,
      );

      const result = await service.findMessagesWithPagination({
        login_id: loginId,
        per_page: 30,
        offset: 10,
        sort: '-created_at',
      });

      expect(
        ticketMessagesRepository.findManyWithPagination,
      ).toHaveBeenCalledWith({
        offset: 10,
        per_page: 30,
        sort: { column: 'created_at', direction: 'desc' },
        where: { login_id: loginId },
      });
      expect(result).toBe(paginationResult);
    });

    it('should throw UnprocessableEntityException when the repository returns a falsy value', async () => {
      ticketMessagesRepository.findManyWithPagination.mockResolvedValue(
        undefined,
      );

      await expect(
        service.findMessagesWithPagination({
          login_id: loginId,
          per_page: 30,
          sort: 'created_at',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('findAssignedAreas', () => {
    it('should return the cached value and skip the repository when present', async () => {
      const cached = [{ id: 'area-1', alias: 'support' }];
      cache.get.mockResolvedValue(cached);

      const result = await service.findAssignedAreas(loginId);

      expect(cache.get).toHaveBeenCalledWith({
        key: 'account:areas',
        item: loginId,
      });
      expect(loginsRepository.findAssignedAreasById).not.toHaveBeenCalled();
      expect(result).toBe(cached);
    });

    it('should return the cached empty array without hitting the repository', async () => {
      cache.get.mockResolvedValue([]);

      const result = await service.findAssignedAreas(loginId);

      expect(loginsRepository.findAssignedAreasById).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should query the repository, flatten assigned_areas and cache the result on cache miss', async () => {
      cache.get.mockResolvedValue(undefined);
      loginsRepository.findAssignedAreasById.mockResolvedValue({
        assigned_areas: [
          { areas: { id: 'area-1', alias: 'support' } },
          { areas: { id: 'area-2', alias: 'billing' } },
        ],
      });

      const result = await service.findAssignedAreas(loginId);

      expect(loginsRepository.findAssignedAreasById).toHaveBeenCalledWith(
        loginId,
      );
      expect(cache.set).toHaveBeenCalledWith({
        key: 'account:areas',
        item: loginId,
        data: [
          { id: 'area-1', alias: 'support' },
          { id: 'area-2', alias: 'billing' },
        ],
        ttl: CACHE_TTL.ten,
      });
      expect(result).toEqual([
        { id: 'area-1', alias: 'support' },
        { id: 'area-2', alias: 'billing' },
      ]);
    });

    it('should return an empty array without caching when the repository returns void (not found or swallowed error)', async () => {
      cache.get.mockResolvedValue(undefined);
      loginsRepository.findAssignedAreasById.mockResolvedValue(undefined);

      const result = await service.findAssignedAreas(loginId);

      expect(cache.set).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should cache and return an empty array when the login genuinely has zero areas', async () => {
      cache.get.mockResolvedValue(undefined);
      loginsRepository.findAssignedAreasById.mockResolvedValue({
        assigned_areas: [],
      });

      const result = await service.findAssignedAreas(loginId);

      expect(cache.set).toHaveBeenCalledWith({
        key: 'account:areas',
        item: loginId,
        data: [],
        ttl: CACHE_TTL.ten,
      });
      expect(result).toEqual([]);
    });
  });
});
