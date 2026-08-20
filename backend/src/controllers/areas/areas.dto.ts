import { IAreaCreatePromise, IAreaUpdatePromise } from '@app/areas';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
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

export class IAreaIdParamDTO {
  @ApiProperty({
    description: 'Area id',
    example: '00000000-0000-0000-0000-000000000001',
    format: 'uuid',
  })
  @IsUUID()
  id: string;
}

export class IAreasListQueryDTO {
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
    example: 'alias',
    type: 'string',
    enum: ['alias', '-alias', 'created_at', '-created_at'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['alias', '-alias', 'created_at', '-created_at'])
  sort: string;
}

export class IAreaAccountsListQueryDTO {
  @ApiProperty({
    description: 'Column sorter over the linked login',
    example: 'username',
    type: 'string',
    enum: ['username', '-username', 'email', '-email'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['username', '-username', 'email', '-email'])
  sort: string;
}

export class IAreaTicketsListQueryDTO {
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
    example: 'created_at',
    type: 'string',
    enum: [
      'created_at',
      '-created_at',
      'updated_at',
      '-updated_at',
      'priority',
      '-priority',
      'subject',
      '-subject',
    ],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'created_at',
    '-created_at',
    'updated_at',
    '-updated_at',
    'priority',
    '-priority',
    'subject',
    '-subject',
  ])
  sort: string;
}

export class IAreaCreateDTO {
  @ApiProperty({
    description: 'Area alias',
    example: 'Support',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  alias: string;

  @ApiProperty({
    description: 'Area description',
    example: 'First line support',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiProperty({
    description: 'Logins assigned to the area. ADMIN or MASTER only',
    example: ['00000000-0000-0000-0000-000000000001'],
    type: [String],
    format: 'uuid',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  logins: string[];
}

export class IAreaUpdateDTO {
  @ApiPropertyOptional({
    description: 'Area alias',
    example: 'Support',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  alias?: string;

  @ApiPropertyOptional({
    description: 'Area description',
    example: 'First line support',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({
    description: 'Replacement set of logins. ADMIN or MASTER only',
    example: ['00000000-0000-0000-0000-000000000001'],
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  logins?: string[];
}

export class IAreaCreateResponseDTO implements IAreaCreatePromise {
  @ApiProperty({ format: 'uuid' })
  id: string;
}

export class IAreaUpdateResponseDTO implements IAreaUpdatePromise {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
