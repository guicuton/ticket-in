import { LOGIN_ROLES, TICKET_RELATIONS } from '@app/database';
import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';
import {
  TICKET_PRIORITY,
  TICKET_STATE,
} from '../../database/prisma/generated/enums';

export interface IAccountValidateLoginParams {
  username: string;
}

export interface IAccountValidateLoginPromise {
  id: string;
  password: string;
  role?: keyof typeof LOGIN_ROLES;
}

export interface IAccountValidatePasswordParams {
  userPassword: string;
  hashPassword: string;
}

export interface IAccountUpdatePasswordParams {
  login_id: string;
  current_password: string;
  new_password: string;
}

export interface IAccountCreateParams {
  username: string;
  password: string;
  email: string;
  role: keyof typeof LOGIN_ROLES;
}

export interface IAccountCreatePromise {
  id: string;
}

export interface IAccountItemListPromise {
  id: string;
  username: string;
  password: string;
  email: string;
  role: keyof typeof LOGIN_ROLES;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
  _count: {
    assigned_areas: number;
    tickets_messages: number;
    tickets_requester: number;
    tickets_responser: number;
  };
}

export interface IAccountListWithPaginationPromise extends TPaginationData {
  data: IAccountItemListPromise[];
}

export interface IAccountFindTicketsParams {
  login_id: string;
  relation: keyof typeof TICKET_RELATIONS;
  per_page: number;
  offset?: number;
  sort: string;
}

export interface IAccountTicketItemListPromise {
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
}

export interface IAccountTicketListWithPaginationPromise extends TPaginationData {
  data: IAccountTicketItemListPromise[];
}

export interface IAccountFindMessagesParams {
  login_id: string;
  per_page: number;
  offset?: number;
  sort: string;
}

export interface IAccountMessageItemListPromise {
  id: string;
  ticket_id: string;
  login_id: string;
  message: string;
  created_at: Date;
}

export interface IAccountMessageListWithPaginationPromise extends TPaginationData {
  data: IAccountMessageItemListPromise[];
}

export interface IAccountAreaItemListPromise {
  id: string;
  alias: string;
}
