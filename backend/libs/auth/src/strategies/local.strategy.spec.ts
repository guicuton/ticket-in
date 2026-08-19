import { LoggerService } from '@app/logger';
import { UserService } from '@app/user';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthStrategyLocal } from './local.strategy';

describe('AuthStrategyLocal', () => {
  let strategy: AuthStrategyLocal;
  let userService: jest.Mocked<UserService>;
  let logger: jest.Mocked<LoggerService>;

  const username = 'admin';
  const password = 'plain-pass';
  const hashedPassword = '$2b$10$hashed';
  const loginId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthStrategyLocal,
        {
          provide: UserService,
          useValue: {
            validateLogin: jest.fn(),
            validatePassword: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: { warn: jest.fn() },
        },
      ],
    }).compile();

    strategy = module.get(AuthStrategyLocal);
    userService = module.get(UserService);
    logger = module.get(LoggerService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the authenticated user when credentials are valid', async () => {
      userService.validateLogin.mockResolvedValue({
        id: loginId,
        password: hashedPassword,
      });
      userService.validatePassword.mockReturnValue(true);

      const result = await strategy.validate(username, password);

      expect(userService.validateLogin).toHaveBeenCalledWith({ username });
      expect(userService.validatePassword).toHaveBeenCalledWith({
        userPassword: password,
        hashPassword: hashedPassword,
      });
      expect(result).toEqual({ username, loginId });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when username is missing', async () => {
      await expect(strategy.validate('', password)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(userService.validateLogin).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is missing', async () => {
      await expect(strategy.validate(username, '')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(userService.validateLogin).not.toHaveBeenCalled();
    });

    it('should log a warning and throw UnauthorizedException when password does not match', async () => {
      userService.validateLogin.mockResolvedValue({
        id: loginId,
        password: hashedPassword,
      });
      userService.validatePassword.mockReturnValue(false);

      await expect(
        strategy.validate(username, password),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(logger.warn).toHaveBeenCalledWith(
        `[AUTH] - USERNAME:${username} | INVALID DATA`,
        AuthStrategyLocal.name,
      );
    });

    it('should propagate errors thrown by userService.validateLogin', async () => {
      const error = new UnauthorizedException();
      userService.validateLogin.mockRejectedValue(error);

      await expect(strategy.validate(username, password)).rejects.toBe(error);
      expect(userService.validatePassword).not.toHaveBeenCalled();
    });
  });
});
