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

export const TICKET_PRIORITIES = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export const TICKET_STATES = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  ESCALATED: 'ESCALATED',
  WAITING_FEEDBACK: 'WAITING_FEEDBACK',
  RESOLVED: 'RESOLVED',
} as const;

export interface ITicketsFindOneParams<Args> {
  where: Args;
}

export interface ITicketsFindOnePromise {
  id: string;
  area_id: string | null;
  requester_login_id: string;
  responser_login_id: string | null;
  subject: string;
  description: string;
  priority: keyof typeof TICKET_PRIORITIES;
  state: keyof typeof TICKET_STATES;
  created_at: Date;
  updated_at: Date;
  area: { id: string; alias: string } | null;
  login_requester: { id: string; username: string };
  login_responser: { id: string; username: string } | null;
  _count: { messages: number };
}

export interface ITicketsCreateOneParams {
  area_id?: string;
  requester_login_id: string;
  subject: string;
  description: string;
  created_at: Date;
}

export interface ITicketsCreateOnePromise {
  id: string;
}

export interface ITicketsUpdateOneParams {
  id: string;
  area_id?: string;
  requester_login_id?: string;
  responser_login_id?: string;
  subject?: string;
  description?: string;
  priority?: keyof typeof TICKET_PRIORITIES;
  state?: keyof typeof TICKET_STATES;
}

export interface ITicketsUpdateOnePromise {
  id: string;
}
