import { FormControl } from '@angular/forms';
import { IPaginationQuery } from '../common/interfaces';

export type IAccountRole = 'ADMIN' | 'MASTER' | 'USER';

export interface IAccountItem {
  id: string;
  username: string;
  email: string;
  role: IAccountRole;
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

export interface IAccountsListParams extends IPaginationQuery {
  email?: string;
  role?: IAccountRole;
}

export interface IAccountsSearchForms {
  email: FormControl<string | null>;
  role: FormControl<IAccountRole | null>;
}

export interface IAccountsSearchParams {
  email?: string | null;
  role?: IAccountRole | null;
}
