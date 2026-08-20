import { Injectable } from '@nestjs/common';
import { offsetPaginator } from 'prisma-offset-paginator';
import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';
import { PAGINATION_OPTIONS } from '../../../../../configuration/constants';
import { DatabaseService } from '../../database.service';
import { emptyPaginationData } from '../pagination';
import {
  IAreasFindAccountsParams,
  IAreasFindAccountsPromise,
  IAreasFindManyWithPaginationParams,
} from './repository.interface';

@Injectable()
export class AreasRepository {
  constructor(private readonly repository: DatabaseService) {}

  async findManyWithPagination<Args>(
    params: IAreasFindManyWithPaginationParams<Args>,
  ): Promise<TPaginationData | void> {
    const { sort, ...prismaParams } = params;

    try {
      const promise = await offsetPaginator({
        instance: this.repository,
        entity: 'areas',
        offset: prismaParams.offset,
        per_page: prismaParams.per_page,
        bottom: PAGINATION_OPTIONS.aroundRange,
        orderBy: sort.column,
        orderDirection: sort.direction,
        where: prismaParams.where,
        include: {
          _count: {
            select: {
              logins: true,
              tickets: true,
            },
          },
        },
      });

      return promise ?? emptyPaginationData();
    } catch (err) {
      this.repository.errorHandler(err as Error);
    }
  }

  async findAccountsById(
    params: IAreasFindAccountsParams,
  ): Promise<IAreasFindAccountsPromise | void> {
    const { id, sort } = params;

    const promise = await this.repository.areas
      .findUnique({
        where: { id },
        select: {
          logins: {
            select: {
              logins: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
            orderBy: {
              logins: {
                [sort.column]: sort.direction,
              },
            },
          },
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }
}
