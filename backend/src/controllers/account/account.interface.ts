import { IAuthenticatedAccount } from '@app/auth';
import { LOGIN_ROLES } from '@app/database';
import {
  IAccountCreateDTO,
  IAccountMessagesListQueryDTO,
  IAccountTicketsListQueryDTO,
  IAuthPutPasswordDTO,
} from './account.dto';

export interface IAuthLoginParams {
  account: IAuthenticatedAccount;
  ip: string;
}

export interface IAuthLoginPromise {
  access_token: string;
}

export interface IAuthLoginPasswordUpdateParams {
  account: IAuthenticatedAccount;
  ip: string;
  body: IAuthPutPasswordDTO;
}

export interface IAccountCreateParams {
  account: IAuthenticatedAccount;
  ip: string;
  body: IAccountCreateDTO;
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

export interface IAccountTicketsListParams {
  account: IAuthenticatedAccount;
  login_id: string;
  query: IAccountTicketsListQueryDTO;
}

export interface IAccountMessagesListParams {
  account: IAuthenticatedAccount;
  login_id: string;
  query: IAccountMessagesListQueryDTO;
}

export interface IAccountAreasListParams {
  account: IAuthenticatedAccount;
  login_id: string;
}
