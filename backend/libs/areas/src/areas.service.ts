import { CacheModuleServices } from '@app/cache';
import { AreasRepository, TicketsRepository } from '@app/database';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { CACHE_TTL } from '../../../configuration/constants';
import { parseSort } from '../../../utils/parse-sort';
import { Prisma } from '../../database/prisma/generated/client';
import {
  IAreaAccountItemListPromise,
  IAreaFindAccountsParams,
  IAreaFindTicketsParams,
  IAreaListWithPaginationPromise,
  IAreasFindManyParams,
  IAreaTicketListWithPaginationPromise,
} from './areas.interface';

@Injectable()
export class AreasService {
  constructor(
    private readonly cache: CacheModuleServices,
    private readonly repository: AreasRepository,
    private readonly ticketsRepository: TicketsRepository,
  ) {}

  async findManyWithPagination(
    params: IAreasFindManyParams,
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
}
