import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database.service';
import { ITicketMessagesFindManyWithPaginationParams } from './repository.interface';
import { offsetPaginator } from 'prisma-offset-paginator';
import { PAGINATION_OPTIONS } from '../../../../../configuration/constants';
import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';

@Injectable()
export class TicketMessagesRepository {
  constructor(private readonly repository: DatabaseService) {}

  async findManyWithPagination<Args>(
    params: ITicketMessagesFindManyWithPaginationParams<Args>,
  ): Promise<TPaginationData | void> {
    const { sort, ...prismaParams } = params;

    const promise = await offsetPaginator({
      instance: this.repository,
      entity: 'ticket_messages',
      offset: prismaParams.offset,
      per_page: prismaParams.per_page,
      bottom: PAGINATION_OPTIONS.aroundRange,
      orderBy: sort.column,
      orderDirection: sort.direction,
      where: prismaParams.where,
    }).catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }
}
