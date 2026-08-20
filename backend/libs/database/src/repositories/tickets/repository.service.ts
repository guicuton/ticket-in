import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database.service';
import { Prisma } from '../../../prisma/generated/client';
import {
  ITicketsCreateOneParams,
  ITicketsCreateOnePromise,
  ITicketsFindManyWithPaginationParams,
  ITicketsFindOneParams,
  ITicketsFindOnePromise,
  ITicketsUpdateOneParams,
  ITicketsUpdateOnePromise,
} from './repository.interface';
import { offsetPaginator } from 'prisma-offset-paginator';
import { PAGINATION_OPTIONS } from '../../../../../configuration/constants';
import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';
import { emptyPaginationData } from '../pagination';

@Injectable()
export class TicketsRepository {
  constructor(private readonly repository: DatabaseService) {}

  async findManyWithPagination<Args>(
    params: ITicketsFindManyWithPaginationParams<Args>,
  ): Promise<TPaginationData | void> {
    const { sort, ...prismaParams } = params;

    try {
      const promise = await offsetPaginator({
        instance: this.repository,
        entity: 'tickets',
        offset: prismaParams.offset,
        per_page: prismaParams.per_page,
        bottom: PAGINATION_OPTIONS.aroundRange,
        orderBy: sort.column,
        orderDirection: sort.direction,
        where: prismaParams.where,
        select: prismaParams.select,
      });

      return promise ?? emptyPaginationData();
    } catch (err) {
      this.repository.errorHandler(err as Error);
    }
  }

  async findOne<Args>(
    params: ITicketsFindOneParams<Args>,
  ): Promise<ITicketsFindOnePromise | void> {
    const promise = await this.repository.tickets
      .findFirst({
        where: params.where as Prisma.ticketsWhereInput,
        select: {
          id: true,
          area_id: true,
          requester_login_id: true,
          responser_login_id: true,
          subject: true,
          description: true,
          priority: true,
          state: true,
          created_at: true,
          updated_at: true,
          area: { select: { id: true, alias: true } },
          login_requester: { select: { id: true, username: true } },
          login_responser: { select: { id: true, username: true } },
          _count: { select: { messages: true } },
        },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }

  async createOne(
    params: ITicketsCreateOneParams,
  ): Promise<ITicketsCreateOnePromise | void> {
    const { area_id, requester_login_id, subject, description, created_at } =
      params;

    const promise = await this.repository.tickets
      .create({
        data: {
          ...(area_id && { area_id }),
          requester_login_id,
          subject,
          description,
          created_at,
        },
        select: { id: true },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }

  async updateOneById(
    params: ITicketsUpdateOneParams,
  ): Promise<ITicketsUpdateOnePromise | void> {
    const {
      id,
      area_id,
      requester_login_id,
      responser_login_id,
      subject,
      description,
      priority,
      state,
    } = params;

    const promise = await this.repository.tickets
      .update({
        where: { id },
        data: {
          ...(area_id && { area_id }),
          ...(requester_login_id && { requester_login_id }),
          ...(responser_login_id && { responser_login_id }),
          ...(subject && { subject }),
          ...(description && { description }),
          ...(priority && { priority }),
          ...(state && { state }),
        },
        select: { id: true },
      })
      .catch((err) => this.repository.errorHandler(err));

    if (promise) return promise;
  }
}
