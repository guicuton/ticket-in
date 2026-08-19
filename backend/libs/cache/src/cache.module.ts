import { Global, Logger, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheModuleServices } from './cache.service';

const RedisClientProvider: Provider = {
  provide: 'REDIS_CLIENT',
  inject: [ConfigService],
  useFactory: (cs: ConfigService) => {
    const logger = new Logger('REDIS');
    const host = cs.get<string>('CACHE.REDIS.HOST') ?? '127.0.0.1';
    const port = cs.get<number>('CACHE.REDIS.PORT') ?? 6379;

    return new Redis({
      host,
      port,
      password: cs.get<string>('CACHE.REDIS.PASS') ?? '12345',
    })
      .on('connect', () =>
        logger.log(`Connection success - HOST:${host} | PORT:${port}`),
      )
      .once('error', (error) => {
        logger.error('Connection Fail', error.stack);
        logger.warn('Shutdown app');
        process.exit(1);
      });
  },
};

@Global()
@Module({
  providers: [CacheModuleServices, RedisClientProvider],
  exports: [CacheModuleServices, RedisClientProvider],
})
export class CacheModule {}
