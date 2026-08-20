import { LOGIN_ROLES } from '@app/database';
import { TPaginationData } from 'prisma-offset-paginator/dist/interfaces';

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
