import type { IAuthenticatedAccount } from '@app/auth';
import {
  IAreaAccountsListQueryDTO,
  IAreaCreateDTO,
  IAreaTicketsListQueryDTO,
  IAreaUpdateDTO,
} from './areas.dto';

export interface IAreaAccountsListParams {
  area_id: string;
  query: IAreaAccountsListQueryDTO;
}

export interface IAreaTicketsListParams {
  area_id: string;
  query: IAreaTicketsListQueryDTO;
}

export interface IAreaCreateControllerParams {
  body: IAreaCreateDTO;
  ip: string;
  account: IAuthenticatedAccount;
}

export interface IAreaUpdateControllerParams {
  id: string;
  body: IAreaUpdateDTO;
  ip: string;
  account: IAuthenticatedAccount;
}
