import { CacheModuleServices } from '@app/cache';
import {
  AreasRepository,
  LoginsRepository,
  TicketsRepository,
} from '@app/database';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_TTL } from '../../../configuration/constants';
import { AreasService } from './areas.service';

describe('AreasService', () => {
  let service: AreasService;
  let cache: jest.Mocked<CacheModuleServices>;
  let repository: jest.Mocked<AreasRepository>;
  let ticketsRepository: jest.Mocked<TicketsRepository>;
  let loginsRepository: jest.Mocked<LoginsRepository>;

  const area_id = '00000000-0000-0000-0000-000000000001';

  const rolesOf = (
    ...entries: [string, 'ADMIN' | 'MASTER' | 'USER'][]
  ): { id: string; role: 'ADMIN' | 'MASTER' | 'USER' }[] =>
    entries.map(([id, role]) => ({ id, role }));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreasService,
        {
          provide: CacheModuleServices,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            deleteCollection: jest.fn(),
          },
        },
        {
          provide: AreasRepository,
          useValue: {
            findManyWithPagination: jest.fn(),
            findAccountsById: jest.fn(),
            createOne: jest.fn(),
            updateOneById: jest.fn(),
          },
        },
        {
          provide: TicketsRepository,
          useValue: {
            findManyWithPagination: jest.fn(),
          },
        },
        {
          provide: LoginsRepository,
          useValue: {
            findManyRolesByIds: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AreasService);
    cache = module.get(CacheModuleServices);
    repository = module.get(AreasRepository);
    ticketsRepository = module.get(TicketsRepository);
    loginsRepository = module.get(LoginsRepository);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findManyWithPagination', () => {
    it('should parse the sort and delegate to the repository', async () => {
      const expected = { data: [], meta: {} } as never;

      repository.findManyWithPagination.mockResolvedValue(expected);

      const result = await service.findManyWithPagination({
        per_page: 10,
        offset: 0,
        sort: '-created_at',
      });

      expect(repository.findManyWithPagination).toHaveBeenCalledWith({
        offset: 0,
        per_page: 10,
        sort: { column: 'created_at', direction: 'desc' },
        where: {},
      });
      expect(result).toBe(expected);
    });

    it('should throw UnprocessableEntityException when the repository returns nothing', async () => {
      repository.findManyWithPagination.mockResolvedValue(undefined);

      await expect(
        service.findManyWithPagination({ per_page: 10, sort: 'alias' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('findAccountsByAreaId', () => {
    const accounts = [
      { id: 'login-a', username: 'admin', email: 'a@b.com' },
    ];

    it('should return the cached value and skip the repository', async () => {
      cache.get.mockResolvedValue(accounts);

      const result = await service.findAccountsByAreaId({
        area_id,
        sort: 'username',
      });

      expect(cache.get).toHaveBeenCalledWith({
        key: 'areas:accounts',
        item: `${area_id}:username`,
      });
      expect(repository.findAccountsById).not.toHaveBeenCalled();
      expect(result).toBe(accounts);
    });

    it('should query the repository on a miss, flatten the join rows and cache them', async () => {
      cache.get.mockResolvedValue(undefined);
      repository.findAccountsById.mockResolvedValue({
        logins: accounts.map((item) => ({ logins: item })),
      });

      const result = await service.findAccountsByAreaId({
        area_id,
        sort: '-email',
      });

      expect(repository.findAccountsById).toHaveBeenCalledWith({
        id: area_id,
        sort: { column: 'email', direction: 'desc' },
      });
      expect(cache.set).toHaveBeenCalledWith({
        key: 'areas:accounts',
        item: `${area_id}:-email`,
        data: accounts,
        ttl: CACHE_TTL.ten,
      });
      expect(result).toEqual(accounts);
    });

    it('should return an empty list when the area does not exist', async () => {
      cache.get.mockResolvedValue(undefined);
      repository.findAccountsById.mockResolvedValue(undefined);

      const result = await service.findAccountsByAreaId({
        area_id,
        sort: 'username',
      });

      expect(cache.set).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('findTicketsByAreaId', () => {
    it('should filter by area_id and select the requester and responser usernames', async () => {
      const expected = { data: [], meta: {} } as never;

      ticketsRepository.findManyWithPagination.mockResolvedValue(expected);

      const result = await service.findTicketsByAreaId({
        area_id,
        per_page: 30,
        offset: 30,
        sort: '-priority',
      });

      expect(ticketsRepository.findManyWithPagination).toHaveBeenCalledWith({
        offset: 30,
        per_page: 30,
        sort: { column: 'priority', direction: 'desc' },
        where: { area_id },
        select: {
          id: true,
          subject: true,
          priority: true,
          state: true,
          created_at: true,
          updated_at: true,
          login_requester: { select: { username: true } },
          login_responser: { select: { username: true } },
        },
      });
      expect(result).toBe(expected);
    });

    it('should throw UnprocessableEntityException when the repository returns nothing', async () => {
      ticketsRepository.findManyWithPagination.mockResolvedValue(undefined);

      await expect(
        service.findTicketsByAreaId({
          area_id,
          per_page: 10,
          sort: 'created_at',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('createOne', () => {
    const params = {
      alias: 'Support',
      description: 'First line support',
      logins: ['login-a', 'login-b'],
    };

    it('should create the area and invalidate both the areas and the account areas caches', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue(
        rolesOf(['login-a', 'ADMIN'], ['login-b', 'MASTER']),
      );
      repository.createOne.mockResolvedValue({ id: area_id });

      const result = await service.createOne(params);

      expect(repository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({
          alias: params.alias,
          description: params.description,
          login_ids: params.logins,
        }),
      );
      expect(cache.deleteCollection).toHaveBeenCalledWith('areas:*');
      expect(cache.deleteCollection).toHaveBeenCalledWith('account:areas:*');
      expect(result).toEqual({ id: area_id });
    });

    it('should reject a login whose role is USER', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue(
        rolesOf(['login-a', 'ADMIN'], ['login-b', 'USER']),
      );

      await expect(service.createOne(params)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(repository.createOne).not.toHaveBeenCalled();
    });

    it('should reject when one of the logins does not exist', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue(
        rolesOf(['login-a', 'ADMIN']),
      );

      await expect(service.createOne(params)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(repository.createOne).not.toHaveBeenCalled();
    });

    it('should deduplicate repeated login ids before validating and creating', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue(
        rolesOf(['login-a', 'ADMIN']),
      );
      repository.createOne.mockResolvedValue({ id: area_id });

      await service.createOne({ ...params, logins: ['login-a', 'login-a'] });

      expect(loginsRepository.findManyRolesByIds).toHaveBeenCalledWith([
        'login-a',
      ]);
      expect(repository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({ login_ids: ['login-a'] }),
      );
    });

    it('should throw UnprocessableEntityException when the repository returns nothing', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue(
        rolesOf(['login-a', 'ADMIN'], ['login-b', 'MASTER']),
      );
      repository.createOne.mockResolvedValue(undefined);

      await expect(service.createOne(params)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(cache.deleteCollection).not.toHaveBeenCalled();
    });
  });

  describe('updateOneById', () => {
    it('should update scalar fields without touching the logins repository', async () => {
      repository.updateOneById.mockResolvedValue({ id: area_id });

      const result = await service.updateOneById({
        id: area_id,
        alias: 'Renamed',
      });

      expect(loginsRepository.findManyRolesByIds).not.toHaveBeenCalled();
      expect(repository.updateOneById).toHaveBeenCalledWith({
        id: area_id,
        alias: 'Renamed',
        description: undefined,
      });
      expect(cache.deleteCollection).toHaveBeenCalledWith('areas:*');
      expect(cache.deleteCollection).toHaveBeenCalledWith('account:areas:*');
      expect(result).toEqual({ id: area_id });
    });

    it('should validate the roles before replacing the link set', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue(
        rolesOf(['login-a', 'MASTER']),
      );
      repository.updateOneById.mockResolvedValue({ id: area_id });

      await service.updateOneById({ id: area_id, logins: ['login-a'] });

      expect(repository.updateOneById).toHaveBeenCalledWith({
        id: area_id,
        alias: undefined,
        description: undefined,
        login_ids: ['login-a'],
      });
    });

    it('should reject a USER role and never reach the repository', async () => {
      loginsRepository.findManyRolesByIds.mockResolvedValue(
        rolesOf(['login-a', 'USER']),
      );

      await expect(
        service.updateOneById({ id: area_id, logins: ['login-a'] }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repository.updateOneById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the area does not exist', async () => {
      repository.updateOneById.mockResolvedValue(undefined);

      await expect(
        service.updateOneById({ id: area_id, alias: 'Renamed' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(cache.deleteCollection).not.toHaveBeenCalled();
    });
  });
});
