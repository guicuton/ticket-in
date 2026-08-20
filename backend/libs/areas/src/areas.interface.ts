import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';
import {
  TICKET_PRIORITY,
  TICKET_STATE,
} from '../../database/prisma/generated/enums';

export interface IAreasFindManyParams {
  offset?: number;
  per_page: number;
  sort: string;
}

export interface IAreaItemListPromise {
  id: string;
  alias: string;
  description: string;
  created_at: Date;
  _count: {
    logins: number;
    tickets: number;
  };
}

export interface IAreaListWithPaginationPromise extends TPaginationData {
  data: IAreaItemListPromise[];
}

export interface IAreaFindAccountsParams {
  area_id: string;
  sort: string;
}

export interface IAreaAccountItemListPromise {
  id: string;
  username: string;
  email: string;
}

export interface IAreaFindTicketsParams {
  area_id: string;
  offset?: number;
  per_page: number;
  sort: string;
}

export interface IAreaTicketItemListPromise {
  id: string;
  subject: string;
  priority: TICKET_PRIORITY;
  state: TICKET_STATE;
  created_at: Date;
  updated_at: Date;
  login_requester: {
    username: string;
  };
  login_responser: {
    username: string;
  } | null;
}

export interface IAreaTicketListWithPaginationPromise extends TPaginationData {
  data: IAreaTicketItemListPromise[];
}
