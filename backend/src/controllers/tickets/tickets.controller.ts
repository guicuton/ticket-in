import type { IAuthenticatedAccount } from '@app/auth';
import { LOGIN_ROLES } from '@app/database';
import {
  ITicketCreatePromise,
  ITicketDetailPromise,
  ITicketListWithPaginationPromise,
  ITicketMessageItemListPromise,
  ITicketUpdatePromise,
} from '@app/tickets';
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
  ITicketCreateDTO,
  ITicketCreateResponseDTO,
  ITicketIdParamDTO,
  ITicketsListQueryDTO,
  ITicketUpdateDTO,
  ITicketUpdateResponseDTO,
} from './tickets.dto';
import { TicketsControllerService } from './tickets.service';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly controllerService: TicketsControllerService) {}

  @ApiOperation({
    summary: 'Get tickets list',
    description:
      'Return a paginated list of tickets with the number of messages on each. A USER only ever sees the tickets they requested; ADMIN and MASTER see every ticket and may filter by requester or responser.',
  })
  @ApiBearerAuth('bearer')
  @ApiExtraModels(ITicketsListQueryDTO)
  @ApiResponse({ status: 200, description: 'Tickets list.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request query.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @Get('list')
  async list(
    @Account() account: IAuthenticatedAccount,
    @Query() query: ITicketsListQueryDTO,
  ): Promise<ITicketListWithPaginationPromise> {
    return await this.controllerService.findAllWithPagination({
      account,
      query,
    });
  }

  @ApiOperation({
    summary: 'Create new ticket',
    description:
      'Creates a ticket for the authenticated account. Priority and state take their defaults, NORMAL and NEW.',
  })
  @ApiBearerAuth('bearer')
  @ApiBody({ type: ITicketCreateDTO })
  @ApiResponse({
    status: 201,
    description: 'Ticket created successfully.',
    type: ITicketCreateResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request body.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 422, description: 'The area does not exist.' })
  @Post('create')
  async create(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Body() body: ITicketCreateDTO,
  ): Promise<ITicketCreatePromise> {
    return await this.controllerService.createOne({ body, ip, account });
  }

  @ApiOperation({
    summary: 'Get a ticket',
    description:
      'Return the full ticket with its message count. A ticket outside the caller scope answers 404, not 403.',
  })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'Ticket detail.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request params.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @Get(':id')
  async detail(
    @Account() account: IAuthenticatedAccount,
    @Param() params: ITicketIdParamDTO,
  ): Promise<ITicketDetailPromise> {
    return await this.controllerService.findOneById({
      ticket_id: params.id,
      account,
    });
  }

  @ApiOperation({
    summary: 'Get a ticket message thread',
    description:
      'Return every message on the ticket, newest first, without pagination.',
  })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'Message thread.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for the request params.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @Get(':id/messages')
  async messages(
    @Account() account: IAuthenticatedAccount,
    @Param() params: ITicketIdParamDTO,
  ): Promise<ITicketMessageItemListPromise[]> {
    return await this.controllerService.findMessages({
      ticket_id: params.id,
      account,
    });
  }

  @ApiOperation({
    summary: 'Update a ticket',
    description:
      'Updates the area, the requester, the responser, the subject, the description, the priority or the state.',
  })
  @ApiBearerAuth('bearer')
  @ApiBody({ type: ITicketUpdateDTO })
  @ApiResponse({
    status: 200,
    description: 'Ticket updated successfully.',
    type: ITicketUpdateResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed, or the request body is empty.',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid token.' })
  @ApiResponse({ status: 403, description: 'Account is not an ADMIN/MASTER.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @ApiResponse({
    status: 422,
    description:
      'The area, the requester or the responser is invalid for this ticket.',
  })
  @Roles(LOGIN_ROLES.ADMIN, LOGIN_ROLES.MASTER)
  @Put(':id')
  async update(
    @Account() account: IAuthenticatedAccount,
    @Ip() ip: string,
    @Param() params: ITicketIdParamDTO,
    @Body() body: ITicketUpdateDTO,
  ): Promise<ITicketUpdatePromise> {
    return await this.controllerService.updateOneById({
      id: params.id,
      body,
      ip,
      account,
    });
  }
}
