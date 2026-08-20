export interface ITicketMessagesFindManyWithPaginationParams<Args> {
  where: Args;
  offset?: number;
  per_page: number;
  sort: {
    column: string;
    direction: 'asc' | 'desc';
  };
}
