import { IAccountCreatePromise } from '@app/account';
import { LOGIN_ROLES } from '@app/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { PAGINATION_OPTIONS } from '../../../configuration/constants';
import { IAuthLoginPromise } from './account.interface';

export class IAccountsListQueryDTO {
  @ApiPropertyOptional({
    description: 'Set the offset page for pagination',
    example: '0',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
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
    example: 'username',
    type: 'string',
    enum: [
      'username',
      '-username',
      'email',
      '-email',
      'role',
      '-role',
      'created_at',
      '-created_at',
    ],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'username',
    '-username',
    'email',
    '-email',
    'role',
    '-role',
    'created_at',
    '-created_at',
  ])
  sort: string;

  @ApiProperty({
    description: 'User email',
    example: 'test@test.com',
    type: 'string',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Roles filter',
    example: 'USER',
    type: 'array',
    enum: LOGIN_ROLES,
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsIn(Object.keys(LOGIN_ROLES), { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.filter((item: string) => item.trim() !== '');
    }

    if (typeof value === 'string') {
      return [value.trim()];
    }
    return [];
  })
  role?: string[];
}

export class IAuthLoginDTO {
  @ApiProperty({
    description: 'Username',
    example: 'admin',
    minLength: 4,
    pattern: '^[A-Za-z0-9]+$',
  })
  @IsString()
  @MinLength(4)
  @Matches(/^[A-Za-z0-9]+$/)
  username: string;

  @ApiProperty({
    description: 'Password (min 4 chars, allowed: A-Z a-z 0-9 ! @ # $ _)',
    example: 'my_super_pass@!',
    minLength: 4,
    pattern: '^[A-Za-z0-9!@#$_]+$',
  })
  @IsString()
  @MinLength(4)
  @Matches(/^[A-Za-z0-9!@#$_]+$/)
  password: string;
}

export class IAuthPutPasswordDTO {
  @ApiProperty({
    description:
      'Current password (min 4 chars, allowed: A-Z a-z 0-9 ! @ # $ _)',
    example: 'OldPass_1',
    minLength: 4,
    pattern: '^[A-Za-z0-9!@#$_]+$',
  })
  @IsString()
  @MinLength(4)
  @Matches(/^[A-Za-z0-9!@#$_]+$/)
  currentPassword: string;

  @ApiProperty({
    description: 'New password (min 4 chars, allowed: A-Z a-z 0-9 ! @ # $ _)',
    example: 'NewPass_1',
    minLength: 4,
    pattern: '^[A-Za-z0-9!@#$_]+$',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @Matches(/^[A-Za-z0-9!@#$_]+$/)
  newPassword: string;
}

export class IAuthLoginResponseDTO implements IAuthLoginPromise {
  @ApiProperty({
    description: 'JWT access token. Use in `Authorization: Bearer <token>`',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;
}

export class IAccountCreateDTO {
  @ApiProperty({
    description: 'Username',
    example: 'johndoe',
    minLength: 4,
    pattern: '^[A-Za-z0-9]+$',
  })
  @IsString()
  @MinLength(4)
  @Matches(/^[A-Za-z0-9]+$/)
  username: string;

  @ApiProperty({
    description: 'New password (min 4 chars, allowed: A-Z a-z 0-9 ! @ # $ _)',
    example: 'NewPass_1',
    minLength: 4,
    pattern: '^[A-Za-z0-9!@#$_]+$',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @Matches(/^[A-Za-z0-9!@#$_]+$/)
  password: string;

  @ApiProperty({
    description: 'User email',
    example: 'test@test.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User role',
    example: 'MASTER',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(Object.keys(LOGIN_ROLES))
  role: keyof typeof LOGIN_ROLES;
}

export class IAccountCreateResponseDTO implements IAccountCreatePromise {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
