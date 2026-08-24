import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database.service';
import {
  ILoginsCreateOneParams,
  ILoginsCreateOnePromise,
  ILoginsFindAllWithPaginationParams,
  ILoginsFindAssignedAreasPromise,
  ILoginsFindFirstParams,
  ILoginsFindFirstPromise,
  ILoginsFindRolesByIdsPromise,
  ILoginsUpdatePasswordParams,
  ILoginsUpdatePasswordPromise,
} from './repository.interface';
import { offsetPaginator } from 'prisma-offset-paginator';
import { PAGINATION_OPTIONS } from '../../../../../configuration/constants';
import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';
import { emptyPaginationData } from '../pagination';

@Injectable()
export class LoginsRepository {
  constructor(private readonly repository: DatabaseService) {}

  async findManyWithPagination<Args>(
    params: ILoginsFindAllWithPaginationParams<Args>,
  ): Promise<TPaginationData | void> {
    try {
      const { sort, ...prismaParams } = params;

      const promise = await offsetPaginator({
        instance: this.repository,
        entity: 'logins',
        offset: prismaParams.offset,
        per_page: prismaParams.per_page,
        bottom: PAGINATION_OPTIONS.aroundRange,
        orderBy: sort.column,
        orderDirection: sort.direction,
        where: prismaParams.where,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          is_deleted: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              assigned_areas: true,
              tickets_messages: true,
              tickets_requester: true,
              tickets_responser: true,
            },
          },
        },
      });

      return promise ?? emptyPaginationData();
    } catch (err) {
      this.repository.errorHandler(err as Error);
    }
  }

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

  async findAssignedAreasById(
    id: string,
  ): Promise<ILoginsFindAssignedAreasPromise | void> {
    const promise = await this.repository.logins
      .findUnique({
        where: { id },
        select: {
          assigned_areas: {
            select: {
              areas: {
                select: {
                  id: true,
                  alias: true,
                },
              },
            },
          },
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }

  async findManyRolesByIds(
    ids: string[],
  ): Promise<ILoginsFindRolesByIdsPromise[] | void> {
    const promise = await this.repository.logins
      .findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          role: true,
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }
}
