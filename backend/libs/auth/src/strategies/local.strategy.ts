import { AccountService } from '@app/account';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { IAuthenticatedAccount } from './strategies.interface';

@Injectable()
export class AuthStrategyLocal extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(AuthStrategyLocal.name);

  constructor(private accountService: AccountService) {
    super();
  }

  async validate(
    username: string,
    password: string,
  ): Promise<IAuthenticatedAccount> {
    if (!username || !password) throw new UnauthorizedException();

    const account = await this.accountService.validateLogin({
      username,
    });

    const validatePassword = this.accountService.validatePassword({
      userPassword: password,
      hashPassword: account.password,
    });

    if (validatePassword) {
      return {
        username,
        role: account.role,
        id: account.id,
      } satisfies IAuthenticatedAccount;
    }

    this.logger.warn(`[AUTH] - USERNAME:${username} | INVALID DATA`);
    throw new UnauthorizedException();
  }
}
