import { LOGIN_ROLES } from '@app/database';

export interface IAuthenticatedAccount {
  username: string;
  role?: keyof typeof LOGIN_ROLES;
  id: string;
}

export interface IJwtGuard {
  access_token: string;
}

export interface IJwtGuardPayload extends Omit<IAuthenticatedAccount, 'id'> {
  sub: string;
  iat?: number;
  exp?: number;
}
