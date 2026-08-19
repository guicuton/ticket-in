import { CacheModuleServices } from '@app/cache';
import { LoginRepository } from '@app/database';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { DEFAULT_TTL } from '../../../utils/constants';
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

  const uuid = '00000000-0000-0000-0000-000000000001';

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
