export interface ITicketMessagesFindManyWithPaginationParams<Args> {
  where: Args;
  offset?: number;
  per_page: number;
  sort: {
    column: string;
    direction: 'asc' | 'desc';
  };
}

export interface ITicketMessagesFindManyByTicketIdParams {
  ticket_id: string;
}

export interface ITicketMessageItemPromise {
  id: string;
  message: string;
  created_at: Date;
  login: {
    id: string;
    username: string;
  };
}
