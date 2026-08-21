import type { IAuthenticatedAccount } from '@app/auth';
import {
  ITicketCreateDTO,
  ITicketMessageCreateDTO,
  ITicketsListQueryDTO,
  ITicketUpdateDTO,
} from './tickets.dto';

export interface ITicketsListParams {
  account: IAuthenticatedAccount;
  query: ITicketsListQueryDTO;
}

export interface ITicketDetailParams {
  ticket_id: string;
  account: IAuthenticatedAccount;
}

export interface ITicketMessagesParams {
  ticket_id: string;
  account: IAuthenticatedAccount;
}

export interface ITicketCreateControllerParams {
  body: ITicketCreateDTO;
  ip: string;
  account: IAuthenticatedAccount;
}

export interface ITicketUpdateControllerParams {
  id: string;
  body: ITicketUpdateDTO;
  ip: string;
  account: IAuthenticatedAccount;
}

export interface ITicketMessageCreateControllerParams {
  ticket_id: string;
  body: ITicketMessageCreateDTO;
  ip: string;
  account: IAuthenticatedAccount;
}
