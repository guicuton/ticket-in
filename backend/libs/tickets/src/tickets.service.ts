import { CacheModuleServices } from '@app/cache';
import {
  AreasRepository,
  LOGIN_ROLES,
  LoginsRepository,
  TicketMessagesRepository,
  TICKET_STATES,
  TicketsRepository,
} from '@app/database';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CACHE_TTL } from '../../../configuration/constants';
import { parseSort } from '../../../utils/parse-sort';
import { Prisma } from '../../database/prisma/generated/client';
import { TICKET_STATE } from '../../database/prisma/generated/enums';
import {
  ITicketCreateMessageParams,
  ITicketCreateMessagePromise,
  ITicketCreateParams,
  ITicketCreatePromise,
  ITicketDetailPromise,
  ITicketFindManyParams,
  ITicketFindMessagesParams,
  ITicketFindOneParams,
  ITicketListWithPaginationPromise,
  ITicketMessageItemListPromise,
  ITicketScopedAccount,
  ITicketUpdateParams,
  ITicketUpdatePromise,
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

  async findOneById(
    params: ITicketFindOneParams,
  ): Promise<ITicketDetailPromise> {
    const { ticket_id, account } = params;

    const cacheKey = 'tickets:detail';
    const cache = await this.cache.get<ITicketDetailPromise>({
      key: cacheKey,
      item: ticket_id,
    });

    if (cache) return this.authorizeTicket(cache, account);

    const repositoryResult =
      await this.repository.findOne<Prisma.ticketsWhereInput>({
        where: { id: ticket_id },
      });

    if (!repositoryResult) throw new NotFoundException('ticket_not_found');

    await this.cache.set({
      key: cacheKey,
      item: ticket_id,
      data: repositoryResult,
      ttl: CACHE_TTL.ten,
    });

    return this.authorizeTicket(repositoryResult, account);
  }

  async findMessagesByTicketId(
    params: ITicketFindMessagesParams,
  ): Promise<ITicketMessageItemListPromise[]> {
    const { ticket_id, account } = params;

    await this.findOneById({ ticket_id, account });

    const cacheKey = 'tickets:messages';
    const cache = await this.cache.get<ITicketMessageItemListPromise[]>({
      key: cacheKey,
      item: ticket_id,
    });

    if (cache) return cache;

    const repositoryResult =
      await this.ticketMessagesRepository.findManyByTicketId({ ticket_id });

    if (!repositoryResult) return [];

    await this.cache.set({
      key: cacheKey,
      item: ticket_id,
      data: repositoryResult,
      ttl: CACHE_TTL.ten,
    });

    return repositoryResult;
  }

  async createOne(params: ITicketCreateParams): Promise<ITicketCreatePromise> {
    const { requester_login_id, subject, description, area_id } = params;

    if (area_id) await this.validateArea(area_id);

    const repositoryResult = await this.repository.createOne({
      requester_login_id,
      subject,
      description,
      ...(area_id && { area_id }),
      created_at: new Date(),
    });

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    return repositoryResult;
  }

  async updateOneById(
    params: ITicketUpdateParams,
  ): Promise<ITicketUpdatePromise> {
    const { id, area_id, requester_login_id, responser_login_id } = params;

    if (area_id) await this.validateArea(area_id);
    if (requester_login_id) await this.validateRequester(requester_login_id);
    if (responser_login_id) await this.validateResponser(responser_login_id);

    const repositoryResult = await this.repository.updateOneById(params);

    if (!repositoryResult) throw new NotFoundException('ticket_not_found');

    await this.invalidateTicketCache(id);

    return repositoryResult;
  }

  private async validateArea(area_id: string): Promise<void> {
    const repositoryResult = await this.areasRepository.findOneById(area_id);

    if (!repositoryResult)
      throw new UnprocessableEntityException('invalid_ticket_area');
  }

  private async validateRequester(login_id: string): Promise<void> {
    const repositoryResult = await this.loginsRepository.findManyRolesByIds([
      login_id,
    ]);

    if (!repositoryResult || repositoryResult.length !== 1)
      throw new UnprocessableEntityException('invalid_ticket_requester');
  }

  private async validateResponser(login_id: string): Promise<void> {
    const repositoryResult = await this.loginsRepository.findManyRolesByIds([
      login_id,
    ]);

    if (!repositoryResult || repositoryResult.length !== 1)
      throw new UnprocessableEntityException('invalid_ticket_responser');

    if (!this.privilegedRoles.includes(repositoryResult[0].role))
      throw new UnprocessableEntityException('invalid_ticket_responser');
  }

  private async invalidateTicketCache(ticket_id: string): Promise<void> {
    await this.cache.delete([
      `tickets:detail:${ticket_id}`,
      `tickets:messages:${ticket_id}`,
    ]);
  }

  private authorizeTicket(
    ticket: ITicketDetailPromise,
    account: ITicketScopedAccount,
  ): ITicketDetailPromise {
    if (this.isPrivileged(account)) return ticket;

    if (ticket.requester_login_id !== account.id)
      throw new NotFoundException('ticket_not_found');

    return ticket;
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

  async createMessage(
    params: ITicketCreateMessageParams,
  ): Promise<ITicketCreateMessagePromise> {
    const { ticket_id, account, message, state } = params;

    const ticket = await this.findOneById({ ticket_id, account });

    if (ticket.state === TICKET_STATES.RESOLVED)
      throw new UnprocessableEntityException('ticket_resolved');

    const nextState = this.resolveMessageState(ticket, account, state);

    const repositoryResult = await this.ticketMessagesRepository.createOne({
      ticket_id,
      login_id: account.id,
      message,
      created_at: new Date(),
      ...(nextState && { state: nextState }),
    });

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    await this.invalidateTicketCache(ticket_id);

    return { id: repositoryResult.id, state: nextState ?? ticket.state };
  }

  private resolveMessageState(
    ticket: ITicketDetailPromise,
    account: ITicketScopedAccount,
    state?: TICKET_STATE,
  ): TICKET_STATE | undefined {
    if (this.isPrivileged(account)) {
      if (!state) throw new BadRequestException('state_required');
      return state;
    }

    if (state) throw new BadRequestException('state_not_allowed');

    if (ticket.state === TICKET_STATES.WAITING_FEEDBACK)
      return TICKET_STATES.IN_PROGRESS;

    return undefined;
  }
}
