import {
  ITicketCreateMessagePromise,
  ITicketCreatePromise,
  ITicketDetailPromise,
  ITicketListWithPaginationPromise,
  ITicketMessageItemListPromise,
  ITicketUpdatePromise,
  TicketsService,
} from '@app/tickets';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ITicketCreateControllerParams,
  ITicketDetailParams,
  ITicketMessageCreateControllerParams,
  ITicketMessagesParams,
  ITicketsListParams,
  ITicketUpdateControllerParams,
} from './tickets.interface';

@Injectable()
export class TicketsControllerService {
  private readonly logger = new Logger(TicketsControllerService.name);

  constructor(private readonly ticketsService: TicketsService) {}

  async findAllWithPagination(
    params: ITicketsListParams,
  ): Promise<ITicketListWithPaginationPromise> {
    const { account, query } = params;

    return await this.ticketsService.findManyWithPagination({
      account,
      ...query,
    });
  }

  async findOneById(
    params: ITicketDetailParams,
  ): Promise<ITicketDetailPromise> {
    const { ticket_id, account } = params;

    return await this.ticketsService.findOneById({ ticket_id, account });
  }

  async findMessages(
    params: ITicketMessagesParams,
  ): Promise<ITicketMessageItemListPromise[]> {
    const { ticket_id, account } = params;

    return await this.ticketsService.findMessagesByTicketId({
      ticket_id,
      account,
    });
  }

  async createOne(
    params: ITicketCreateControllerParams,
  ): Promise<ITicketCreatePromise> {
    const { body, ip, account } = params;

    const serviceResult = await this.ticketsService.createOne({
      subject: body.subject,
      description: body.description,
      ...(body.area_id && { area_id: body.area_id }),
      requester_login_id: account.id,
    });

    this.logger.log(
      `[createOne] - LOGINID:${account.id} | TICKETID:${serviceResult.id} | IP:${ip} - TICKET CREATED`,
    );

    return serviceResult;
  }

  async updateOneById(
    params: ITicketUpdateControllerParams,
  ): Promise<ITicketUpdatePromise> {
    const { id, body, ip, account } = params;

    const hasUpdatableField = [
      body.area_id,
      body.requester_login_id,
      body.responser_login_id,
      body.subject,
      body.description,
      body.priority,
      body.state,
    ].some((field) => field !== undefined);

    if (!hasUpdatableField) throw new BadRequestException('empty_payload');

    const serviceResult = await this.ticketsService.updateOneById({
      id,
      ...body,
    });

    this.logger.log(
      `[updateOneById] - LOGINID:${account.id} | TICKETID:${serviceResult.id} | IP:${ip} - TICKET UPDATED`,
    );

    return serviceResult;
  }

  async createMessage(
    params: ITicketMessageCreateControllerParams,
  ): Promise<ITicketCreateMessagePromise> {
    const { ticket_id, body, ip, account } = params;

    const serviceResult = await this.ticketsService.createMessage({
      ticket_id,
      account,
      message: body.message,
      ...(body.state && { state: body.state }),
    });

    this.logger.log(
      `[createMessage] - LOGINID:${account.id} | TICKETID:${ticket_id} | MESSAGEID:${serviceResult.id} | STATE:${serviceResult.state} | IP:${ip} - MESSAGE CREATED`,
    );

    return serviceResult;
  }
}
