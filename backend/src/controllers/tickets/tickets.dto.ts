import { TICKET_PRIORITIES, TICKET_STATES } from '@app/database';
import {
  ITicketCreateMessagePromise,
  ITicketCreatePromise,
  ITicketUpdatePromise,
} from '@app/tickets';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PAGINATION_OPTIONS } from '../../../configuration/constants';

const TICKET_SORTS = [
  'created_at',
  '-created_at',
  'updated_at',
  '-updated_at',
  'priority',
  '-priority',
  'state',
  '-state',
  'subject',
  '-subject',
];

const toArray = ({ value }: { value: unknown }): string[] => {
  if (Array.isArray(value)) {
    return (value as string[]).filter((item) => item.trim() !== '');
  }

  if (typeof value === 'string') {
    return [value.trim()];
  }

  return [];
};

export class ITicketIdParamDTO {
  @ApiProperty({
    description: 'Ticket id',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsUUID()
  id: string;
}

export class ITicketsListQueryDTO {
  @ApiPropertyOptional({
    description: 'Set the offset page for pagination',
    example: '0',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @ApiProperty({
    description: 'Items per page',
    example: '10',
    type: 'number',
  })
  @IsIn(PAGINATION_OPTIONS.perPage)
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  per_page: number;

  @ApiProperty({
    description: 'Column sorter',
    example: '-created_at',
    type: 'string',
    enum: TICKET_SORTS,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(TICKET_SORTS)
  sort: string;

  @ApiPropertyOptional({
    description: 'State filter',
    example: 'NEW',
    type: 'array',
    enum: TICKET_STATES,
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsIn(Object.keys(TICKET_STATES), { each: true })
  @Transform(toArray)
  state?: (keyof typeof TICKET_STATES)[];

  @ApiPropertyOptional({
    description: 'Priority filter',
    example: 'URGENT',
    type: 'array',
    enum: TICKET_PRIORITIES,
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsIn(Object.keys(TICKET_PRIORITIES), { each: true })
  @Transform(toArray)
  priority?: (keyof typeof TICKET_PRIORITIES)[];

  @ApiPropertyOptional({
    description: 'Area filter',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  area_id?: string;

  @ApiPropertyOptional({
    description: 'Requester filter. Honoured for ADMIN/MASTER only',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  requester_login_id?: string;

  @ApiPropertyOptional({
    description: 'Responser filter. Honoured for ADMIN/MASTER only',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  responser_login_id?: string;
}

export class ITicketCreateDTO {
  @ApiPropertyOptional({
    description: 'Area the ticket belongs to',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  area_id?: string;

  @ApiProperty({
    description: 'Ticket subject',
    example: 'Printer is down',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({
    description: 'Ticket description',
    example: 'Third floor printer stopped responding after the power cut',
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class ITicketUpdateDTO {
  @ApiPropertyOptional({
    description: 'Area the ticket belongs to',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  area_id?: string;

  @ApiPropertyOptional({
    description: 'Requester login. Any role',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  requester_login_id?: string;

  @ApiPropertyOptional({
    description: 'Responser login. ADMIN or MASTER only',
    example: '019538c4-2f7a-7c31-9c1b-5b6d3a1f4e20',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  responser_login_id?: string;

  @ApiPropertyOptional({
    description: 'Ticket subject',
    example: 'Printer is down',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({
    description: 'Ticket description',
    example: 'Third floor printer stopped responding after the power cut',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({
    description: 'Ticket priority',
    example: 'URGENT',
    enum: Object.keys(TICKET_PRIORITIES),
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.keys(TICKET_PRIORITIES))
  priority?: keyof typeof TICKET_PRIORITIES;

  @ApiPropertyOptional({
    description: 'Ticket state',
    example: 'IN_PROGRESS',
    enum: Object.keys(TICKET_STATES),
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.keys(TICKET_STATES))
  state?: keyof typeof TICKET_STATES;
}

export class ITicketCreateResponseDTO implements ITicketCreatePromise {
  @ApiProperty({ format: 'uuid' })
  id: string;
}

export class ITicketUpdateResponseDTO implements ITicketUpdatePromise {
  @ApiProperty({ format: 'uuid' })
  id: string;
}

export class ITicketMessageCreateDTO {
  @ApiProperty({
    description: 'Message body',
    example: 'The printer is still not responding after the reboot',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @ApiPropertyOptional({
    description:
      'Resulting ticket state. Required for ADMIN/MASTER, rejected for USER',
    example: 'WAITING_FEEDBACK',
    enum: Object.keys(TICKET_STATES),
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.keys(TICKET_STATES))
  state?: keyof typeof TICKET_STATES;
}

export class ITicketMessageCreateResponseDTO implements ITicketCreateMessagePromise {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: Object.keys(TICKET_STATES) })
  state: keyof typeof TICKET_STATES;
}
