import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthStrategyJwt } from './jwt.strategy';
import { IJwtGuardPayload } from './strategies.interface';

describe('AuthStrategyJwt', () => {
  describe('constructor', () => {
    it('should throw when JWT_SECRET is not configured', async () => {
      const moduleBuilder = Test.createTestingModule({
        providers: [
          AuthStrategyJwt,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      });

      await expect(moduleBuilder.compile()).rejects.toThrow(
        'invalid_jwt_secret',
      );
    });
  });

  describe('validate', () => {
    let strategy: AuthStrategyJwt;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthStrategyJwt,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('test-secret'),
            },
          },
        ],
      }).compile();

      strategy = module.get(AuthStrategyJwt);
    });

    it('should map the jwt payload to an authenticated account', () => {
      const payload: IJwtGuardPayload = {
        username: 'admin',
        sub: '019538c4-2f7a-7c31-9c1b-000000000001',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        username: payload.username,
        id: payload.sub,
        role: undefined,
      });
    });

    it('should carry the role from the payload onto the account', () => {
      const payload: IJwtGuardPayload = {
        username: 'admin',
        sub: '019538c4-2f7a-7c31-9c1b-000000000001',
        role: 'MASTER',
      };

      const result = strategy.validate(payload);

      expect(result.role).toBe('MASTER');
    });

    it('should drop the issued-at and expiry claims from the account', () => {
      const payload: IJwtGuardPayload = {
        username: 'admin',
        sub: '019538c4-2f7a-7c31-9c1b-000000000001',
        role: 'USER',
        iat: 1_700_000_000,
        exp: 1_700_003_600,
      };

      const result = strategy.validate(payload);

      expect(result).not.toHaveProperty('iat');
      expect(result).not.toHaveProperty('exp');
      expect(result).not.toHaveProperty('sub');
    });
  });
});
