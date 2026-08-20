import {
  IAccountCreatePromise,
  IAccountListWithPaginationPromise,
} from '@app/account';
import type { IAuthenticatedAccount } from '@app/auth';
import { LocalAuthGuard } from '@app/auth';
import { LOGIN_ROLES } from '@app/database';
import {
  Body,
  Controller,
  Get,
  Ip,
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
  IAccountsListQueryDTO,
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
}
