import { Test, TestingModule } from '@nestjs/testing';
import { CacheModuleServices } from './cache.service';

describe('CacheModuleServices', () => {
  let service: CacheModuleServices;
  let redis: {
    scan: jest.Mock;
    set: jest.Mock;
    get: jest.Mock;
    exists: jest.Mock;
    unlink: jest.Mock;
    pipeline: jest.Mock;
  };
  let pipelineExec: jest.Mock;

  beforeEach(async () => {
    pipelineExec = jest.fn();
    redis = {
      scan: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
      exists: jest.fn(),
      unlink: jest.fn(),
      pipeline: jest.fn().mockReturnValue({ exec: pipelineExec }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheModuleServices,
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    service = module.get(CacheModuleServices);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('collectionKeys', () => {
    it('should iterate scan with cursor until 0 is returned and dedupe keys', async () => {
      redis.scan
        .mockResolvedValueOnce(['10', ['a', 'b']])
        .mockResolvedValueOnce(['0', ['b', 'c']]);

      const result = await service.collectionKeys('prefix:*');

      expect(redis.scan).toHaveBeenNthCalledWith(
        1,
        '0',
        'MATCH',
        'prefix:*',
        'COUNT',
        1000,
      );
      expect(redis.scan).toHaveBeenNthCalledWith(
        2,
        '10',
        'MATCH',
        'prefix:*',
        'COUNT',
        1000,
      );
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('set', () => {
    it('should stringify non-string data and call redis.set without TTL when ttl is absent', async () => {
      await service.set({ key: 'k', data: { a: 1 } });

      expect(redis.set).toHaveBeenCalledWith('k', JSON.stringify({ a: 1 }));
    });

    it('should join key+item with ":" when item is provided', async () => {
      await service.set({ key: 'k', item: 'sub', data: 'value' });

      expect(redis.set).toHaveBeenCalledWith('k:sub', 'value');
    });

    it('should pass EX with the numeric ttl when provided', async () => {
      await service.set({ key: 'k', data: 'value', ttl: '60' });

      expect(redis.set).toHaveBeenCalledWith('k', 'value', 'EX', 60);
    });
  });

  describe('get', () => {
    it('should return undefined when the key does not exist', async () => {
      redis.exists.mockResolvedValue(0);

      const result = await service.get({ key: 'k', item: 'sub' });

      expect(redis.exists).toHaveBeenCalledWith('k:sub');
      expect(redis.get).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should JSON.parse the cached value when valid JSON', async () => {
      redis.exists.mockResolvedValue(1);
      redis.get.mockResolvedValue(JSON.stringify({ a: 1 }));

      const result = await service.get<{ a: number }>({ key: 'k', item: 's' });

      expect(redis.get).toHaveBeenCalledWith('k:s');
      expect(result).toEqual({ a: 1 });
    });

    it('should return the raw string when the cached value is not valid JSON', async () => {
      redis.exists.mockResolvedValue(1);
      redis.get.mockResolvedValue('not-json');

      const result = await service.get<string>({ key: 'k', item: 's' });

      expect(result).toBe('not-json');
    });
  });

  describe('delete', () => {
    it('should call redis.unlink with the keys when the array is non-empty', async () => {
      await service.delete(['a', 'b']);

      expect(redis.unlink).toHaveBeenCalledWith(['a', 'b']);
      expect(redis.pipeline).toHaveBeenCalledTimes(1);
      expect(pipelineExec).toHaveBeenCalledTimes(1);
    });

    it('should not call redis.unlink when the array is empty', async () => {
      await service.delete([]);

      expect(redis.unlink).not.toHaveBeenCalled();
      expect(redis.pipeline).not.toHaveBeenCalled();
    });
  });

  describe('deleteCollection', () => {
    it('should resolve scan keys then unlink them', async () => {
      redis.scan.mockResolvedValueOnce(['0', ['x', 'y']]);

      await service.deleteCollection('prefix:*');

      expect(redis.unlink).toHaveBeenCalledWith(['x', 'y']);
    });

    it('should not call unlink when the collection is empty', async () => {
      redis.scan.mockResolvedValueOnce(['0', []]);

      await service.deleteCollection('prefix:*');

      expect(redis.unlink).not.toHaveBeenCalled();
    });
  });
});
