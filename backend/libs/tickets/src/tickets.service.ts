import { CacheModuleServices } from '@app/cache';
import {
  AreasRepository,
  LOGIN_ROLES,
  LoginsRepository,
  TicketMessagesRepository,
  TicketsRepository,
} from '@app/database';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { parseSort } from '../../../utils/parse-sort';
import { Prisma } from '../../database/prisma/generated/client';
import {
  ITicketFindManyParams,
  ITicketListWithPaginationPromise,
  ITicketScopedAccount,
} from './tickets.interface';

@Injectable()
export class TicketsService {
  private readonly privilegedRoles: string[] = [
    LOGIN_ROLES.ADMIN,
    LOGIN_ROLES.MASTER,
  ];

  constructor(
    private readonly cache: CacheModuleServices,
    private readonly repository: TicketsRepository,
    private readonly ticketMessagesRepository: TicketMessagesRepository,
    private readonly loginsRepository: LoginsRepository,
    private readonly areasRepository: AreasRepository,
  ) {}

  async findManyWithPagination(
    params: ITicketFindManyParams,
  ): Promise<ITicketListWithPaginationPromise> {
    const { per_page, offset } = params;
    const sort = parseSort(params.sort);

    const repositoryResult =
      await this.repository.findManyWithPagination<Prisma.ticketsWhereInput>({
        offset,
        per_page,
        sort,
        where: this.buildScopedWhere(params),
        select: {
          id: true,
          subject: true,
          priority: true,
          state: true,
          created_at: true,
          updated_at: true,
          area: { select: { id: true, alias: true } },
          login_requester: { select: { username: true } },
          login_responser: { select: { username: true } },
          _count: { select: { messages: true } },
        },
      });

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    return repositoryResult;
  }

  private isPrivileged(account: ITicketScopedAccount): boolean {
    return !!account.role && this.privilegedRoles.includes(account.role);
  }

  private buildScopedWhere(
    params: ITicketFindManyParams,
  ): Prisma.ticketsWhereInput {
    const {
      account,
      state,
      priority,
      area_id,
      requester_login_id,
      responser_login_id,
    } = params;

    const filters: Prisma.ticketsWhereInput = {
      ...(state && state.length > 0 && { state: { in: state } }),
      ...(priority && priority.length > 0 && { priority: { in: priority } }),
      ...(area_id && { area_id }),
    };

    if (!this.isPrivileged(account))
      return { ...filters, requester_login_id: account.id };

    return {
      ...filters,
      ...(requester_login_id && { requester_login_id }),
      ...(responser_login_id && { responser_login_id }),
    };
  }
}
