export const LOGIN_ROLES = {
  ADMIN: 'ADMIN',
  MASTER: 'MASTER',
  USER: 'USER',
} as const;

export interface ILoginsFindFirstParams {
  username?: string;
  email?: string;
}

export interface ILoginsFindFirstPromise {
  id: string;
  password: string;
  role?: keyof typeof LOGIN_ROLES;
}

export interface ILoginsUpdatePasswordParams {
  password_hash: string;
  login_id: string;
}

export interface ILoginsUpdatePasswordPromise {
  id: string;
}

export interface ILoginsCreateOneParams {
  username: string;
  password: string;
  email: string;
  role: keyof typeof LOGIN_ROLES;
  created_at: Date;
}

export interface ILoginsCreateOnePromise {
  id: string;
}
