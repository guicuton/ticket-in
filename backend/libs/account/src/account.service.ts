import { CacheModuleServices } from '@app/cache';
import {
  ILoginsUpdatePasswordPromise,
  LoginsRepository,
  TICKET_RELATIONS,
  TicketMessagesRepository,
  TicketsRepository,
} from '@app/database';
import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CACHE_TTL } from '../../../configuration/constants';
import { IAccountsListQueryDTO } from '../../../src/controllers/account/account.dto';
import { parseSort } from '../../../utils/parse-sort';
import { Prisma } from '../../database/prisma/generated/client';
import { LOGIN_ROLE } from '../../database/prisma/generated/enums';
import {
  IAccountAreaItemListPromise,
  IAccountCreateParams,
  IAccountCreatePromise,
  IAccountFindMessagesParams,
  IAccountFindTicketsParams,
  IAccountListWithPaginationPromise,
  IAccountMessageListWithPaginationPromise,
  IAccountTicketListWithPaginationPromise,
  IAccountUpdatePasswordParams,
  IAccountValidateLoginParams,
  IAccountValidateLoginPromise,
  IAccountValidatePasswordParams,
} from './account.interface';

@Injectable()
export class AccountService {
  constructor(
    private readonly cache: CacheModuleServices,
    private readonly repository: LoginsRepository,
    private readonly ticketsRepository: TicketsRepository,
    private readonly ticketMessagesRepository: TicketMessagesRepository,
  ) {}

  async findManyWithPagination(
    params: IAccountsListQueryDTO,
  ): Promise<IAccountListWithPaginationPromise> {
    const { per_page, offset, role, email } = params;
    const parsedRoles: Array<keyof typeof LOGIN_ROLE> = [];
    const sort = parseSort(params.sort);

    if (role && role.length > 0) {
      role.map((item) => parsedRoles.push(LOGIN_ROLE[item]));
    }

    const repositoryResult =
      await this.repository.findManyWithPagination<Prisma.loginsWhereInput>({
        offset,
        per_page,
        sort,
        where: {
          ...(parsedRoles.length > 0 && {
            role: {
              in: parsedRoles,
            },
          }),
          ...(email && {
            email: {
              contains: email,
            },
          }),
        },
      });

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    return repositoryResult;
  }

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

  async findTicketsWithPagination(
    params: IAccountFindTicketsParams,
  ): Promise<IAccountTicketListWithPaginationPromise> {
    const { login_id, relation, per_page, offset, sort } = params;
    const parsedSort = parseSort(sort);

    const where: Prisma.ticketsWhereInput =
      relation === TICKET_RELATIONS.requester
        ? { requester_login_id: login_id }
        : { responser_login_id: login_id };

    const repositoryResult =
      await this.ticketsRepository.findManyWithPagination<Prisma.ticketsWhereInput>(
        {
          offset,
          per_page,
          sort: parsedSort,
          where,
        },
      );

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    return repositoryResult;
  }

  async findMessagesWithPagination(
    params: IAccountFindMessagesParams,
  ): Promise<IAccountMessageListWithPaginationPromise> {
    const { login_id, per_page, offset, sort } = params;
    const parsedSort = parseSort(sort);

    const repositoryResult =
      await this.ticketMessagesRepository.findManyWithPagination<Prisma.ticket_messagesWhereInput>(
        {
          offset,
          per_page,
          sort: parsedSort,
          where: { login_id },
        },
      );

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    return repositoryResult;
  }

  async findAssignedAreas(
    login_id: string,
  ): Promise<IAccountAreaItemListPromise[]> {
    const cacheKey = 'account:areas';
    const cacheItem = login_id;
    const cache = await this.cache.get<IAccountAreaItemListPromise[]>({
      key: cacheKey,
      item: cacheItem,
    });

    if (cache) return cache;

    const repositoryResult =
      await this.repository.findAssignedAreasById(login_id);

    const areas: IAccountAreaItemListPromise[] = repositoryResult
      ? repositoryResult.assigned_areas.map((item) => item.areas)
      : [];

    await this.cache.set({
      key: cacheKey,
      item: cacheItem,
      data: areas,
      ttl: CACHE_TTL.ten,
    });

    return areas;
  }
}
