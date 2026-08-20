import { CacheModuleServices } from '@app/cache';
import { AreasRepository, TicketsRepository } from '@app/database';
import { UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_TTL } from '../../../configuration/constants';
import { AreasService } from './areas.service';

describe('AreasService', () => {
  let service: AreasService;
  let cache: jest.Mocked<CacheModuleServices>;
  let repository: jest.Mocked<AreasRepository>;
  let ticketsRepository: jest.Mocked<TicketsRepository>;

  const area_id = '00000000-0000-0000-0000-000000000001';

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
          },
        },
        {
          provide: TicketsRepository,
          useValue: {
            findManyWithPagination: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AreasService);
    cache = module.get(CacheModuleServices);
    repository = module.get(AreasRepository);
    ticketsRepository = module.get(TicketsRepository);
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
});
