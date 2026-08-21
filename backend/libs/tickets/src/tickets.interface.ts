import { LOGIN_ROLES } from '@app/database';
import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';
import {
  TICKET_PRIORITY,
  TICKET_STATE,
} from '../../database/prisma/generated/enums';

export interface ITicketScopedAccount {
  id: string;
  role?: keyof typeof LOGIN_ROLES;
}

export interface ITicketFindManyParams {
  account: ITicketScopedAccount;
  offset?: number;
  per_page: number;
  sort: string;
  state?: TICKET_STATE[];
  priority?: TICKET_PRIORITY[];
  area_id?: string;
  requester_login_id?: string;
  responser_login_id?: string;
}

export interface ITicketItemListPromise {
  id: string;
  subject: string;
  priority: TICKET_PRIORITY;
  state: TICKET_STATE;
  created_at: Date;
  updated_at: Date;
  area: {
    id: string;
    alias: string;
  } | null;
  login_requester: {
    username: string;
  };
  login_responser: {
    username: string;
  } | null;
  _count: {
    messages: number;
  };
}

export interface ITicketListWithPaginationPromise extends TPaginationData {
  data: ITicketItemListPromise[];
}

export interface ITicketFindOneParams {
  ticket_id: string;
  account: ITicketScopedAccount;
}

export interface ITicketDetailPromise {
  id: string;
  area_id: string | null;
  requester_login_id: string;
  responser_login_id: string | null;
  subject: string;
  description: string;
  priority: TICKET_PRIORITY;
  state: TICKET_STATE;
  created_at: Date;
  updated_at: Date;
  area: {
    id: string;
    alias: string;
  } | null;
  login_requester: {
    id: string;
    username: string;
  };
  login_responser: {
    id: string;
    username: string;
  } | null;
  _count: {
    messages: number;
  };
}

export interface ITicketFindMessagesParams {
  ticket_id: string;
  account: ITicketScopedAccount;
}

export interface ITicketMessageItemListPromise {
  id: string;
  message: string;
  created_at: Date;
  login: {
    id: string;
    username: string;
  };
}

export interface ITicketCreateParams {
  requester_login_id: string;
  subject: string;
  description: string;
  area_id?: string;
}

export interface ITicketCreatePromise {
  id: string;
}

export interface ITicketUpdateParams {
  id: string;
  area_id?: string;
  requester_login_id?: string;
  responser_login_id?: string;
  subject?: string;
  description?: string;
  priority?: TICKET_PRIORITY;
  state?: TICKET_STATE;
}

export interface ITicketUpdatePromise {
  id: string;
}

export interface ITicketCreateMessageParams {
  ticket_id: string;
  account: ITicketScopedAccount;
  message: string;
  state?: TICKET_STATE;
}

export interface ITicketCreateMessagePromise {
  id: string;
  state: TICKET_STATE;
}
