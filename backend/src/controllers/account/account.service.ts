import {
  AccountService,
  IAccountAreaItemListPromise,
  IAccountCreatePromise,
  IAccountListWithPaginationPromise,
  IAccountMessageListWithPaginationPromise,
  IAccountTicketListWithPaginationPromise,
} from '@app/account';
import { IAuthenticatedAccount } from '@app/auth';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  IAccountAreasListParams,
  IAccountCreateParams,
  IAccountMessagesListParams,
  IAccountTicketsListParams,
  IAuthLoginPasswordUpdateParams,
  IAuthLoginPromise,
} from './account.interface';
import { IAccountsListQueryDTO } from './account.dto';

@Injectable()
export class AccountControllerService {
  private readonly logger = new Logger(AccountControllerService.name);

  constructor(
    private readonly accountService: AccountService,
    private readonly jwtService: JwtService,
  ) {}

  async findAllWithPagination(
    query: IAccountsListQueryDTO,
  ): Promise<IAccountListWithPaginationPromise> {
    return await this.accountService.findManyWithPagination({
      ...query,
    });
  }

  async login(
    params: IAuthenticatedAccount,
    ip: string,
  ): Promise<IAuthLoginPromise> {
    const { username, id, role } = params;

    const token = await this.jwtService.signAsync({
      username,
      role,
      sub: id,
    });

    this.logger.log(`[login] - LOGINID:${id} | IP:${ip} - SIGNIN`);

    return {
      access_token: token,
    };
  }

  async createOne(
    params: IAccountCreateParams,
  ): Promise<IAccountCreatePromise> {
    const { body, ip, account } = params;

    const serviceResult = await this.accountService.createOne(body);

    this.logger.log(
      `[update] - ADMINID:${account.id} | CREATED_LOGINID:${serviceResult.id} | IP:${ip} - USER CREATED`,
    );

    return serviceResult;
  }

  async update(params: IAuthLoginPasswordUpdateParams): Promise<void> {
    const { body, ip, account } = params;
    const { currentPassword, newPassword } = body;

    const { id } = await this.accountService.updatePassword({
      login_id: account.id,
      current_password: currentPassword,
      new_password: newPassword,
    });

    this.logger.log(`[update] - LOGINID:${id} | IP:${ip} - PASSWORD UPDATE`);
  }

  async findTicketsWithPagination(
    data: IAccountTicketsListParams,
  ): Promise<IAccountTicketListWithPaginationPromise> {
    const { login_id, query } = data;
    return await this.accountService.findTicketsWithPagination({
      login_id,
      ...query,
    });
  }

  async findMessagesWithPagination(
    params: IAccountMessagesListParams,
  ): Promise<IAccountMessageListWithPaginationPromise> {
    const { login_id, query } = params;
    return await this.accountService.findMessagesWithPagination({
      login_id,
      ...query,
    });
  }

  async findAssignedAreas(
    params: IAccountAreasListParams,
  ): Promise<IAccountAreaItemListPromise[]> {
    const { login_id } = params;
    return await this.accountService.findAssignedAreas(login_id);
  }
}
