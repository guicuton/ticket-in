import { IAuthenticatedAccount } from '@app/auth';
import { IAuthCreateDTO, IAuthPutPasswordDTO } from './account.dto';

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

export interface IAuthLoginCreateParams {
  account: IAuthenticatedAccount;
  ip: string;
  body: IAuthCreateDTO;
}

export interface IAuthLoginCreatePromise {
  id: string;
}
