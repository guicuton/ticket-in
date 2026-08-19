import { CacheModuleServices } from '@app/cache';
import { ILoginsUpdatePasswordPromise, LoginsRepository } from '@app/database';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  IAccountCreateParams,
  IAccountCreatePromise,
  IAccountUpdatePasswordParams,
  IAccountValidateLoginParams,
  IAccountValidateLoginPromise,
  IAccountValidatePasswordParams,
} from './account.interface';
import { CACHE_TTL } from '../../../configuration/constants';

@Injectable()
export class AccountService {
  constructor(
    private readonly cache: CacheModuleServices,
    private readonly repository: LoginsRepository,
  ) {}

  async createOne(
    params: IAccountCreateParams,
  ): Promise<IAccountCreatePromise> {
    const { username, password, email, role } = params;
    const passwordHash = bcrypt.hashSync(password, 10);

    const repositoryResult = await this.repository.createOne({
      username,
      email,
      role,
      password: passwordHash,
      created_at: new Date(),
    });

    if (repositoryResult) {
      return repositoryResult;
    }

    throw new UnauthorizedException();
  }

  async updatePassword(
    params: IAccountUpdatePasswordParams,
  ): Promise<ILoginsUpdatePasswordPromise> {
    const { login_id, current_password, new_password } = params;
    const repositoryResult = await this.repository.findOneById(login_id);

    if (!repositoryResult) throw new UnauthorizedException();

    if (
      !this.validatePassword({
        userPassword: current_password,
        hashPassword: repositoryResult.password,
      })
    ) {
      throw new UnauthorizedException();
    }

    const newPasswordHash = bcrypt.hashSync(new_password, 10);
    const repositoryUpdateResult = await this.repository.updatePasswordById({
      login_id,
      password_hash: newPasswordHash,
    });

    if (!repositoryUpdateResult) throw new UnauthorizedException();

    await this.cache.deleteCollection('auth:*');
    return repositoryUpdateResult;
  }

  async validateLogin(
    params: IAccountValidateLoginParams,
  ): Promise<IAccountValidateLoginPromise> {
    const { username } = params;

    const cacheKey = 'auth';
    const cacheItem = username;
    const cache = await this.cache.get<IAccountValidateLoginPromise>({
      key: cacheKey,
      item: cacheItem,
    });

    if (cache) return cache;

    const repositoryResult =
      await this.repository.findOneByUsernameOrEmail(params);

    if (repositoryResult) {
      await this.cache.set({
        key: cacheKey,
        item: cacheItem,
        data: repositoryResult,
        ttl: CACHE_TTL.five,
      });
      return repositoryResult;
    }

    throw new UnauthorizedException();
  }

  validatePassword(params: IAccountValidatePasswordParams): boolean {
    const { hashPassword, userPassword } = params;
    return bcrypt.compareSync(userPassword, hashPassword);
  }
}
