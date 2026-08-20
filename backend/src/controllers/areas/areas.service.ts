import {
  AreasService,
  IAreaAccountItemListPromise,
  IAreaCreatePromise,
  IAreaListWithPaginationPromise,
  IAreaTicketListWithPaginationPromise,
  IAreaUpdatePromise,
} from '@app/areas';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IAreasListQueryDTO } from './areas.dto';
import {
  IAreaAccountsListParams,
  IAreaCreateControllerParams,
  IAreaTicketsListParams,
  IAreaUpdateControllerParams,
} from './areas.interface';

@Injectable()
export class AreasControllerService {
  private readonly logger = new Logger(AreasControllerService.name);

  constructor(private readonly areasService: AreasService) {}

  async findAllWithPagination(
    query: IAreasListQueryDTO,
  ): Promise<IAreaListWithPaginationPromise> {
    return await this.areasService.findManyWithPagination({
      ...query,
    });
  }

  async findAccounts(
    params: IAreaAccountsListParams,
  ): Promise<IAreaAccountItemListPromise[]> {
    const { area_id, query } = params;

    return await this.areasService.findAccountsByAreaId({
      area_id,
      ...query,
    });
  }

  async findTicketsWithPagination(
    params: IAreaTicketsListParams,
  ): Promise<IAreaTicketListWithPaginationPromise> {
    const { area_id, query } = params;

    return await this.areasService.findTicketsByAreaId({
      area_id,
      ...query,
    });
  }

  async createOne(
    params: IAreaCreateControllerParams,
  ): Promise<IAreaCreatePromise> {
    const { body, ip, account } = params;

    const serviceResult = await this.areasService.createOne(body);

    this.logger.log(
      `[createOne] - LOGINID:${account.id} | AREAID:${serviceResult.id} | IP:${ip} - AREA CREATED`,
    );

    return serviceResult;
  }

  async updateOneById(
    params: IAreaUpdateControllerParams,
  ): Promise<IAreaUpdatePromise> {
    const { id, body, ip, account } = params;

    if (
      body.alias === undefined &&
      body.description === undefined &&
      body.logins === undefined
    ) {
      throw new BadRequestException('empty_payload');
    }

    const serviceResult = await this.areasService.updateOneById({
      id,
      ...body,
    });

    this.logger.log(
      `[updateOneById] - LOGINID:${account.id} | AREAID:${serviceResult.id} | IP:${ip} - AREA UPDATED`,
    );

    return serviceResult;
  }
}
