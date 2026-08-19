import { IAuthenticatedAccount } from '@app/auth';
import { IAccountCreateDTO, IAuthPutPasswordDTO } from './account.dto';

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

export interface IAccountCreatePromise {
  id: string;
}
