import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheGet, CacheSet } from './cache.interface';

@Injectable()
export class CacheModuleServices {
  constructor(@Inject('REDIS_CLIENT') private cache: Redis) {}

  async collectionKeys(pattern: string): Promise<string[]> {
    let cursor = '0';
    const keys = new Set<string>();

    do {
      const [newCursor, batch] = await this.cache.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        1000,
      );

      cursor = newCursor;
      batch.forEach((key) => keys.add(key));
    } while (cursor !== '0');

    return Array.from(keys);
  }

  async set(params: CacheSet): Promise<void> {
    let { data } = params;
    const { key, item, ttl } = params;
    let parsedKey: string = key;

    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }

    if (item) {
      parsedKey = [key, item].join(':');
    }

    if (ttl) {
      await this.cache.set(parsedKey, String(data), 'EX', Number(ttl));
    } else {
      await this.cache.set(parsedKey, String(data));
    }
  }

  async get<T>(params: CacheGet): Promise<T | void> {
    const { key, item } = params;
    let parsedKey: string = key;

    if (item) {
      parsedKey = [key, item].join(':');
    }

    const keyExists = await this.cache.exists(parsedKey);

    if (keyExists > 0) {
      const data = await this.cache.get(parsedKey);
      if (data) {
        try {
          return JSON.parse(data) as T;
        } catch {
          return data as T;
        }
      }
    }
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length > 0) {
      const pipeline = this.cache.pipeline();
      await this.cache.unlink(keys);
      await pipeline.exec();
    }
  }

  async deleteCollection(pattern: string): Promise<void> {
    const collections = await this.collectionKeys(pattern);

    if (collections.length > 0) {
      const pipeline = this.cache.pipeline();
      await this.cache.unlink(collections);
      await pipeline.exec();
    }
  }
}
