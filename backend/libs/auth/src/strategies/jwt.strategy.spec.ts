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

    it('should map the jwt payload to an authenticated user', () => {
      const payload: IJwtGuardPayload = {
        username: 'admin',
        sub: '00000000-0000-0000-0000-000000000001',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        username: payload.username,
        loginId: payload.sub,
      });
    });
  });
});
