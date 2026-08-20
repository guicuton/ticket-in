import {
  IAreaAccountItemListPromise,
  IAreaCreatePromise,
  IAreaListWithPaginationPromise,
  IAreaTicketListWithPaginationPromise,
  IAreaUpdatePromise,
} from '@app/areas';
import type { IAuthenticatedAccount } from '@app/auth';
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
import { Roles } from '../../../decorators/roles.decorator';
import {
  IAreaAccountsListQueryDTO,
  IAreaCreateDTO,
  IAreaCreateResponseDTO,
  IAreaIdParamDTO,
  IAreasListQueryDTO,
  IAreaTicketsListQueryDTO,
  IAreaUpdateDTO,
  IAreaUpdateResponseDTO,
} from './areas.dto';
import { AreasControllerService } from './areas.service';

@ApiTags('Areas')
@Controller('areas')
export class AreasController {
  constructor(private readonly controllerService: AreasControllerService) {}

  @ApiOperation({
    summary: 'Get areas list',
    description:
      'Return a paginated list of areas with the number of linked logins and tickets.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(IAreasListQueryDTO)
  @ApiResponse({ status: 200, description: 'Areas list.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request query.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Get('list')
  async list(
    @Query() query: IAreasListQueryDTO,
  ): Promise<IAreaListWithPaginationPromise> {
    return await this.controllerService.findAllWithPagination(query);
  }

  @ApiOperation({
    summary: 'Get accounts assigned to an area',
    description:
      'Return the full list of logins assigned to the given area, without pagination.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(IAreaAccountsListQueryDTO)
  @ApiResponse({ status: 200, description: 'Assigned accounts list.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request params/query.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Get(':id/accounts')
  async accounts(
    @Param() params: IAreaIdParamDTO,
    @Query() query: IAreaAccountsListQueryDTO,
  ): Promise<IAreaAccountItemListPromise[]> {
    return await this.controllerService.findAccounts({
      area_id: params.id,
      query,
    });
  }

  @ApiOperation({
    summary: 'Get tickets assigned to an area',
    description:
      'Return a paginated list of the tickets assigned to the given area.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(IAreaTicketsListQueryDTO)
  @ApiResponse({ status: 200, description: 'Tickets list.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request params/query.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Get(':id/tickets')
  async tickets(
    @Param() params: IAreaIdParamDTO,
    @Query() query: IAreaTicketsListQueryDTO,
  ): Promise<IAreaTicketListWithPaginationPromise> {
    return await this.controllerService.findTicketsWithPagination({
      area_id: params.id,
      query,
    });
  }

  @ApiOperation({
    summary: 'Create new area',
    description:
      'Creates an area already linked to one or more ADMIN/MASTER logins.',
  })
  @ApiBearerAuth('bearer')
  @ApiBody({ type: IAreaCreateDTO })
  @ApiResponse({
    status: 201,
    description: 'Area created successfully.',
    type: IAreaCreateResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request body.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @ApiResponse({
    status: 422,
    description: 'One of the logins does not exist or is not an ADMIN/MASTER.',
  })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Post('create')
  async create(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Body() body: IAreaCreateDTO,
  ): Promise<IAreaCreatePromise> {
    return await this.controllerService.createOne({
      body,
      ip,
      account,
    });
  }

  @ApiOperation({
    summary: 'Update an area',
    description:
      'Updates the alias, the description, or the whole set of logins linked to the area.',
  })
  @ApiBearerAuth('bearer')
  @ApiBody({ type: IAreaUpdateDTO })
  @ApiResponse({
    status: 200,
    description: 'Area updated successfully.',
    type: IAreaUpdateResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed, or the request body is empty.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @ApiResponse({ status: 404, description: 'Area not found.' })
  @ApiResponse({
    status: 422,
    description: 'One of the logins does not exist or is not an ADMIN/MASTER.',
  })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Put(':id')
  async update(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Param() params: IAreaIdParamDTO,
    @Body() body: IAreaUpdateDTO,
  ): Promise<IAreaUpdatePromise> {
    return await this.controllerService.updateOneById({
      id: params.id,
      body,
      ip,
      account,
    });
  }
}
