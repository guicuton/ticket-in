export const TICKET_RELATIONS = {
  requester: 'requester',
  responser: 'responser',
} as const;

export interface ITicketsFindManyWithPaginationParams<Args> {
  where: Args;
  offset?: number;
  per_page: number;
  select?: object;
  sort: {
    column: string;
    direction: 'asc' | 'desc';
  };
}
