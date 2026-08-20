import {
  IAccountAreaItemListPromise,
  IAccountCreatePromise,
  IAccountListWithPaginationPromise,
  IAccountMessageListWithPaginationPromise,
  IAccountTicketListWithPaginationPromise,
} from '@app/account';
import type { IAuthenticatedAccount } from '@app/auth';
import { LocalAuthGuard } from '@app/auth';
import { LOGIN_ROLES } from '@app/database';
import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Account } from '../../../decorators/account.decorator';
import { Public } from '../../../decorators/public.decorator';
import { Roles } from '../../../decorators/roles.decorator';
import {
  IAccountCreateDTO,
  IAccountIdParamDTO,
  IAccountMessagesListQueryDTO,
  IAccountsListQueryDTO,
  IAccountTicketsListQueryDTO,
  IAuthLoginDTO,
  IAuthLoginResponseDTO,
  IAuthPutPasswordDTO,
} from './account.dto';
import { IAuthLoginPromise } from './account.interface';
import { AccountControllerService } from './account.service';

@ApiTags('Accounts')
@Controller('accounts')
export class AccountController {
  constructor(private readonly controllerService: AccountControllerService) {}

  @ApiOperation({
    summary: 'Sign in with username and password',
    description:
      'Authenticates a account using account and pass to get the access_token.',
  })
  @ApiBody({ type: IAuthLoginDTO })
  @ApiResponse({
    status: 201,
    description: 'Authenticated successfully.',
    type: IAuthLoginResponseDTO,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('authentication')
  async login(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
  ): Promise<IAuthLoginPromise> {
    return await this.controllerService.login(account, ip);
  }

  @ApiOperation({
    summary: 'Create new account',
    description: 'Registered users can add new account',
  })
  @ApiBearerAuth('bearer')
  @ApiBody({ type: IAccountCreateDTO })
  @ApiResponse({
    status: 201,
    description: 'Account created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request body.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or wrong current password.',
  })
  @Roles(LOGIN_ROLES.ADMIN)
  @Post('create')
  async register(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Body() body: IAccountCreateDTO,
  ): Promise<IAccountCreatePromise> {
    return await this.controllerService.createOne({
      body,
      ip,
      account,
    });
  }

  @ApiOperation({
    summary: 'Update the authenticated account password',
    description:
      'Validates the current password and replaces it with a new one for the authenticated account.',
  })
  @ApiBearerAuth('bearer')
  @ApiBody({ type: IAuthPutPasswordDTO })
  @ApiResponse({ status: 200, description: 'Password updated successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request body.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or wrong current password.',
  })
  @Put('password')
  async update(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Body() body: IAuthPutPasswordDTO,
  ): Promise<void> {
    await this.controllerService.update({
      body,
      ip,
      account,
    });
  }

  @ApiOperation({
    summary: 'Get users list',
    description: 'Return list of all users with pagination',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(IAccountsListQueryDTO)
  @ApiResponse({
    status: 200,
    description: 'Users list.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Get('list')
  async list(
    @Query() query: IAccountsListQueryDTO,
  ): Promise<IAccountListWithPaginationPromise> {
    return await this.controllerService.findAllWithPagination(query);
  }

  @ApiOperation({
    summary: 'Get tickets related to the authenticated account',
    description:
      'Return a paginated list of tickets where the authenticated account is the requester or the responser.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(IAccountTicketsListQueryDTO)
  @ApiResponse({
    status: 200,
    description: 'Tickets list.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request query.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token.',
  })
  @Get('tickets')
  async tickets(
    @Account() account: IAuthenticatedAccount,
    @Query() query: IAccountTicketsListQueryDTO,
  ): Promise<IAccountTicketListWithPaginationPromise> {
    return await this.controllerService.findTicketsWithPagination({
      login_id: account.id,
      query,
    });
  }

  @ApiOperation({
    summary: 'Get tickets related to any account',
    description:
      'Return a paginated list of tickets where the given account is the requester or the responser.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(IAccountTicketsListQueryDTO)
  @ApiResponse({
    status: 200,
    description: 'Tickets list.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request params/query.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Account is not an ADMIN/MASTER.',
  })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Get(':id/tickets')
  async ticketsById(
    @Param() params: IAccountIdParamDTO,
    @Query() query: IAccountTicketsListQueryDTO,
  ): Promise<IAccountTicketListWithPaginationPromise> {
    return await this.controllerService.findTicketsWithPagination({
      login_id: params.id,
      query,
    });
  }

  @ApiOperation({
    summary: 'Get messages sent by the authenticated account',
    description:
      'Return a paginated list of ticket messages sent by the authenticated account.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(IAccountMessagesListQueryDTO)
  @ApiResponse({
    status: 200,
    description: 'Messages list.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request query.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token.',
  })
  @Get('messages')
  async messages(
    @Account() account: IAuthenticatedAccount,
    @Query() query: IAccountMessagesListQueryDTO,
  ): Promise<IAccountMessageListWithPaginationPromise> {
    return await this.controllerService.findMessagesWithPagination({
      login_id: account.id,
      query,
    });
  }

  @ApiOperation({
    summary: 'Get messages sent by any account',
    description:
      'Return a paginated list of ticket messages sent by the given account.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(IAccountMessagesListQueryDTO)
  @ApiResponse({
    status: 200,
    description: 'Messages list.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request params/query.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Account is not an ADMIN/MASTER.',
  })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Get(':id/messages')
  async messagesById(
    @Param() params: IAccountIdParamDTO,
    @Query() query: IAccountMessagesListQueryDTO,
  ): Promise<IAccountMessageListWithPaginationPromise> {
    return await this.controllerService.findMessagesWithPagination({
      login_id: params.id,
      query,
    });
  }

  @ApiOperation({
    summary: 'Get areas assigned to the authenticated account',
    description:
      'Return the list of areas assigned to the authenticated account.',
  })
  @ApiBearerAuth('bearer')
  @ApiResponse({
    status: 200,
    description: 'Assigned areas list.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token.',
  })
  @Get('areas')
  async areas(
    @Account() account: IAuthenticatedAccount,
  ): Promise<IAccountAreaItemListPromise[]> {
    return await this.controllerService.findAssignedAreas({
      login_id: account.id,
    });
  }

  @ApiOperation({
    summary: 'Get areas assigned to any account',
    description: 'Return the list of areas assigned to the given account.',
  })
  @ApiBearerAuth('bearer')
  @ApiResponse({
    status: 200,
    description: 'Assigned areas list.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request params.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Account is not an ADMIN/MASTER.',
  })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Get(':id/areas')
  async areasById(
    @Param() params: IAccountIdParamDTO,
  ): Promise<IAccountAreaItemListPromise[]> {
    return await this.controllerService.findAssignedAreas({
      login_id: params.id,
    });
  }
}
