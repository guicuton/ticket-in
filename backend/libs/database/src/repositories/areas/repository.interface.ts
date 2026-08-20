export interface IAreasFindManyWithPaginationParams<Args> {
  where: Args;
  offset?: number;
  per_page: number;
  sort: {
    column: string;
    direction: 'asc' | 'desc';
  };
}

export interface IAreasFindAccountsParams {
  id: string;
  sort: {
    column: string;
    direction: 'asc' | 'desc';
  };
}

export interface IAreasFindAccountsPromise {
  logins: {
    logins: {
      id: string;
      username: string;
      email: string;
    };
  }[];
}

export interface IAreasCreateOneParams {
  alias: string;
  description: string;
  created_at: Date;
  login_ids: string[];
}

export interface IAreasCreateOnePromise {
  id: string;
}

export interface IAreasUpdateOneParams {
  id: string;
  alias?: string;
  description?: string;
  login_ids?: string[];
}

export interface IAreasUpdateOnePromise {
  id: string;
}

export interface IAreasFindOneByIdPromise {
  id: string;
}
