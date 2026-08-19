import type { IAuthenticatedAccount } from '@app/auth';
import { JwtAuthGuard, LocalAuthGuard } from '@app/auth';
import { Body, Controller, Ip, Post, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Account } from '../../../decorators/account.decorator';
import {
  IAuthCreateDTO,
  IAuthLoginCreateResponseDTO,
  IAuthLoginDTO,
  IAuthLoginResponseDTO,
  IAuthPutPasswordDTO,
} from './account.dto';
import {
  IAuthLoginCreatePromise,
  IAuthLoginPromise,
} from './account.interface';
import { AccountControllerService } from './account.service';

@ApiTags('Account')
@Controller('account')
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
  @UseGuards(LocalAuthGuard)
  @Post('login')
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
  @ApiBody({ type: IAuthCreateDTO })
  @ApiResponse({
    status: 201,
    description: 'Account created successfully.',
    type: IAuthLoginCreateResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request body.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or wrong current password.',
  })
  @UseGuards(JwtAuthGuard)
  @Post('create')
  async register(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Body() body: IAuthCreateDTO,
  ): Promise<IAuthLoginCreatePromise> {
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
  @UseGuards(JwtAuthGuard)
  @Put('password')
  async update(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Body() body: IAuthPutPasswordDTO,
  ): Promise<void> {
    return await this.controllerService.update({
      body,
      ip,
      account,
    });
  }
}
