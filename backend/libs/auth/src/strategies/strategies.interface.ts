import { LOGIN_ROLES } from '@app/database';

export interface IAuthenticatedAccount {
  username: string;
  role?: keyof typeof LOGIN_ROLES;
  id: string;
}

export interface IJwtGuard {
  access_token: string;
}

export interface IJwtGuardPayload {
  username: string;
  id: string;
  settings: {
    role: string;
  };
  sub: string;
  iat?: number;
  exp?: number;
}
