import { AccountService } from '@app/account';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthStrategyLocal } from './local.strategy';

describe('AuthStrategyLocal', () => {
  let strategy: AuthStrategyLocal;
  let accountService: jest.Mocked<AccountService>;
  let warn: jest.SpyInstance;

  const username = 'admin';
  const password = 'plain-pass';
  const hashedPassword = '$2b$10$hashed';
  const loginId = '019538c4-2f7a-7c31-9c1b-000000000001';

  beforeEach(async () => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthStrategyLocal,
        {
          provide: AccountService,
          useValue: {
            validateLogin: jest.fn(),
            validatePassword: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get(AuthStrategyLocal);
    accountService = module.get(AccountService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the authenticated account when credentials are valid', async () => {
      accountService.validateLogin.mockResolvedValue({
        id: loginId,
        password: hashedPassword,
        role: 'ADMIN',
      });
      accountService.validatePassword.mockReturnValue(true);

      const result = await strategy.validate(username, password);

      expect(accountService.validateLogin).toHaveBeenCalledWith({ username });
      expect(accountService.validatePassword).toHaveBeenCalledWith({
        userPassword: password,
        hashPassword: hashedPassword,
      });
      expect(result).toEqual({ username, id: loginId, role: 'ADMIN' });
      expect(warn).not.toHaveBeenCalled();
    });

    it('should carry an account with no role through untouched', async () => {
      accountService.validateLogin.mockResolvedValue({
        id: loginId,
        password: hashedPassword,
      });
      accountService.validatePassword.mockReturnValue(true);

      const result = await strategy.validate(username, password);

      expect(result).toEqual({ username, id: loginId, role: undefined });
    });

    it('should never expose the password hash on the authenticated account', async () => {
      accountService.validateLogin.mockResolvedValue({
        id: loginId,
        password: hashedPassword,
        role: 'USER',
      });
      accountService.validatePassword.mockReturnValue(true);

      const result = await strategy.validate(username, password);

      expect(result).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException when username is missing', async () => {
      await expect(strategy.validate('', password)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(accountService.validateLogin).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is missing', async () => {
      await expect(strategy.validate(username, '')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(accountService.validateLogin).not.toHaveBeenCalled();
    });

    it('should log a warning and throw UnauthorizedException when the password does not match', async () => {
      accountService.validateLogin.mockResolvedValue({
        id: loginId,
        password: hashedPassword,
        role: 'USER',
      });
      accountService.validatePassword.mockReturnValue(false);

      await expect(
        strategy.validate(username, password),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(warn).toHaveBeenCalledWith(
        `[AUTH] - USERNAME:${username} | INVALID DATA`,
      );
    });

    it('should propagate errors thrown by accountService.validateLogin', async () => {
      const error = new UnauthorizedException();
      accountService.validateLogin.mockRejectedValue(error);

      await expect(strategy.validate(username, password)).rejects.toBe(error);
      expect(accountService.validatePassword).not.toHaveBeenCalled();
    });
  });
});
