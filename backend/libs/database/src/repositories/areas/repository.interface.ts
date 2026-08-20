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
