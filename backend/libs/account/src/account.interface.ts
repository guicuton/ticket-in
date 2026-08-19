import { LOGIN_ROLES } from '@app/database';

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
