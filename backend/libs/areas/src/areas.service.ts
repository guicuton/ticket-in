import { CacheModuleServices } from '@app/cache';
import {
  AreasRepository,
  LOGIN_ROLES,
  LoginsRepository,
  TicketsRepository,
} from '@app/database';
import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CACHE_TTL } from '../../../configuration/constants';
import { parseSort } from '../../../utils/parse-sort';
import { Prisma } from '../../database/prisma/generated/client';
import {
  IAreaAccountItemListPromise,
  IAreaCreateParams,
  IAreaCreatePromise,
  IAreaFindAccountsParams,
  IAreaFindManyParams,
  IAreaFindTicketsParams,
  IAreaListWithPaginationPromise,
  IAreaTicketListWithPaginationPromise,
  IAreaUpdateParams,
  IAreaUpdatePromise,
} from './areas.interface';

@Injectable()
export class AreasService {
  private readonly assignableRoles: string[] = [
    LOGIN_ROLES.ADMIN,
    LOGIN_ROLES.MASTER,
  ];

  constructor(
    private readonly cache: CacheModuleServices,
    private readonly repository: AreasRepository,
    private readonly ticketsRepository: TicketsRepository,
    private readonly loginsRepository: LoginsRepository,
  ) {}

  async findManyWithPagination(
    params: IAreaFindManyParams,
  ): Promise<IAreaListWithPaginationPromise> {
    const { per_page, offset } = params;
    const sort = parseSort(params.sort);

    const repositoryResult =
      await this.repository.findManyWithPagination<Prisma.areasWhereInput>({
        offset,
        per_page,
        sort,
        where: {},
      });

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    return repositoryResult;
  }

  async findAccountsByAreaId(
    params: IAreaFindAccountsParams,
  ): Promise<IAreaAccountItemListPromise[]> {
    const { area_id, sort } = params;

    const cacheKey = 'areas:accounts';
    const cacheItem = [area_id, sort].join(':');
    const cache = await this.cache.get<IAreaAccountItemListPromise[]>({
      key: cacheKey,
      item: cacheItem,
    });

    if (cache) return cache;

    const repositoryResult = await this.repository.findAccountsById({
      id: area_id,
      sort: parseSort(sort),
    });

    if (!repositoryResult) return [];

    const accounts = repositoryResult.logins.map((item) => item.logins);

    await this.cache.set({
      key: cacheKey,
      item: cacheItem,
      data: accounts,
      ttl: CACHE_TTL.ten,
    });

    return accounts;
  }

  async findTicketsByAreaId(
    params: IAreaFindTicketsParams,
  ): Promise<IAreaTicketListWithPaginationPromise> {
    const { area_id, per_page, offset } = params;
    const sort = parseSort(params.sort);

    const repositoryResult =
      await this.ticketsRepository.findManyWithPagination<Prisma.ticketsWhereInput>(
        {
          offset,
          per_page,
          sort,
          where: { area_id },
          select: {
            id: true,
            subject: true,
            priority: true,
            state: true,
            created_at: true,
            updated_at: true,
            login_requester: { select: { username: true } },
            login_responser: { select: { username: true } },
          },
        },
      );

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    return repositoryResult;
  }

  async createOne(params: IAreaCreateParams): Promise<IAreaCreatePromise> {
    const { alias, description, logins } = params;
    const login_ids = [...new Set(logins)];

    await this.validateAssignableLogins(login_ids);

    const repositoryResult = await this.repository.createOne({
      alias,
      description,
      login_ids,
      created_at: new Date(),
    });

    if (!repositoryResult)
      throw new UnprocessableEntityException('repository_error');

    await this.invalidateCache();

    return repositoryResult;
  }

  async updateOneById(params: IAreaUpdateParams): Promise<IAreaUpdatePromise> {
    const { id, alias, description, logins } = params;
    const login_ids = logins ? [...new Set(logins)] : undefined;

    if (login_ids) await this.validateAssignableLogins(login_ids);

    const repositoryResult = await this.repository.updateOneById({
      id,
      alias,
      description,
      ...(login_ids && { login_ids }),
    });

    if (!repositoryResult) throw new NotFoundException('area_not_found');

    await this.invalidateCache();

    return repositoryResult;
  }

  private async validateAssignableLogins(login_ids: string[]): Promise<void> {
    const repositoryResult =
      await this.loginsRepository.findManyRolesByIds(login_ids);

    if (!repositoryResult || repositoryResult.length !== login_ids.length)
      throw new UnprocessableEntityException('invalid_area_logins');

    const hasForbiddenRole = repositoryResult.some(
      (item) => !this.assignableRoles.includes(item.role),
    );

    if (hasForbiddenRole)
      throw new UnprocessableEntityException('invalid_area_logins');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache.deleteCollection('areas:*');
    await this.cache.deleteCollection('account:areas:*');
    await this.cache.deleteCollection('tickets:detail:*');
  }
}
