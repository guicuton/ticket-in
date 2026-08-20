import { AreasService } from '@app/areas';
import type { IAuthenticatedAccount } from '@app/auth';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AreasControllerService } from './areas.service';

describe('AreasControllerService', () => {
  let controllerService: AreasControllerService;
  let areasService: jest.Mocked<AreasService>;

  const account: IAuthenticatedAccount = {
    username: 'admin',
    id: '00000000-0000-0000-0000-000000000001',
    role: 'MASTER',
  };
  const area_id = '00000000-0000-0000-0000-000000000002';
  const ip = '127.0.0.1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreasControllerService,
        {
          provide: AreasService,
          useValue: {
            findManyWithPagination: jest.fn(),
            findAccountsByAreaId: jest.fn(),
            findTicketsByAreaId: jest.fn(),
            createOne: jest.fn(),
            updateOneById: jest.fn(),
          },
        },
      ],
    }).compile();

    controllerService = module.get(AreasControllerService);
    areasService = module.get(AreasService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controllerService).toBeDefined();
  });

  describe('findAllWithPagination', () => {
    it('should delegate the query to the domain service', async () => {
      const query = { per_page: 10, sort: 'alias' };
      const expected = { data: [], meta: {} } as never;

      areasService.findManyWithPagination.mockResolvedValue(expected);

      const result = await controllerService.findAllWithPagination(query);

      expect(areasService.findManyWithPagination).toHaveBeenCalledWith(query);
      expect(result).toBe(expected);
    });
  });

  describe('findAccounts', () => {
    it('should merge the area id with the query', async () => {
      areasService.findAccountsByAreaId.mockResolvedValue([]);

      await controllerService.findAccounts({
        area_id,
        query: { sort: 'username' },
      });

      expect(areasService.findAccountsByAreaId).toHaveBeenCalledWith({
        area_id,
        sort: 'username',
      });
    });
  });

  describe('findTicketsWithPagination', () => {
    it('should merge the area id with the query', async () => {
      const expected = { data: [], meta: {} } as never;

      areasService.findTicketsByAreaId.mockResolvedValue(expected);

      const result = await controllerService.findTicketsWithPagination({
        area_id,
        query: { per_page: 10, offset: 0, sort: 'created_at' },
      });

      expect(areasService.findTicketsByAreaId).toHaveBeenCalledWith({
        area_id,
        per_page: 10,
        offset: 0,
        sort: 'created_at',
      });
      expect(result).toBe(expected);
    });
  });

  describe('createOne', () => {
    const body = {
      alias: 'Support',
      description: 'First line support',
      logins: ['00000000-0000-0000-0000-000000000003'],
    };

    it('should delegate the body and return the created id', async () => {
      areasService.createOne.mockResolvedValue({ id: area_id });

      const result = await controllerService.createOne({ body, ip, account });

      expect(areasService.createOne).toHaveBeenCalledWith(body);
      expect(result).toEqual({ id: area_id });
    });

    it('should propagate errors thrown by the domain service', async () => {
      const error = new Error('domain');

      areasService.createOne.mockRejectedValue(error);

      await expect(
        controllerService.createOne({ body, ip, account }),
      ).rejects.toBe(error);
    });
  });

  describe('updateOneById', () => {
    it('should merge the id with the body', async () => {
      areasService.updateOneById.mockResolvedValue({ id: area_id });

      const result = await controllerService.updateOneById({
        id: area_id,
        body: { alias: 'Renamed' },
        ip,
        account,
      });

      expect(areasService.updateOneById).toHaveBeenCalledWith({
        id: area_id,
        alias: 'Renamed',
      });
      expect(result).toEqual({ id: area_id });
    });

    it('should reject an empty body before reaching the domain service', async () => {
      await expect(
        controllerService.updateOneById({ id: area_id, body: {}, ip, account }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(areasService.updateOneById).not.toHaveBeenCalled();
    });
  });
});
