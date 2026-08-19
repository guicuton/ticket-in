import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database.service';
import {
  ILoginsCreateOneParams,
  ILoginsCreateOnePromise,
  ILoginsFindFirstParams,
  ILoginsFindFirstPromise,
  ILoginsUpdatePasswordParams,
  ILoginsUpdatePasswordPromise,
} from './repository.interface';

@Injectable()
export class LoginsRepository {
  constructor(private readonly repository: DatabaseService) {}

  async createOne(
    params: ILoginsCreateOneParams,
  ): Promise<ILoginsCreateOnePromise | void> {
    const promise = await this.repository.logins
      .create({
        data: params,
        select: {
          id: true,
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }

  async findOneById(id: string): Promise<ILoginsFindFirstPromise | void> {
    const promise = await this.repository.logins
      .findUnique({
        where: { id },
        select: {
          id: true,
          password: true,
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }

  async findOneByUsernameOrEmail(
    params: ILoginsFindFirstParams,
  ): Promise<ILoginsFindFirstPromise | void> {
    const promise = await this.repository.logins
      .findFirst({
        where: params,
        select: {
          id: true,
          password: true,
          role: true,
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }

  async updatePasswordById(
    params: ILoginsUpdatePasswordParams,
  ): Promise<ILoginsUpdatePasswordPromise | void> {
    const { password_hash, login_id } = params;
    const promise = await this.repository.logins
      .update({
        data: {
          password: password_hash,
        },
        where: {
          id: login_id,
        },
        select: {
          id: true,
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }
}
