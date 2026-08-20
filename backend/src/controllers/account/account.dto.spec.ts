import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  IAccountMessagesListQueryDTO,
  IAccountTicketsListQueryDTO,
} from './account.dto';

describe('IAccountTicketsListQueryDTO', () => {
  it('should reject a negative offset', async () => {
    const dto = plainToInstance(IAccountTicketsListQueryDTO, {
      relation: 'requester',
      per_page: 10,
      sort: 'created_at',
      offset: -1,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'offset')).toBe(true);
  });

  it('should accept a zero offset', async () => {
    const dto = plainToInstance(IAccountTicketsListQueryDTO, {
      relation: 'requester',
      per_page: 10,
      sort: 'created_at',
      offset: 0,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'offset')).toBe(false);
  });
});

describe('IAccountMessagesListQueryDTO', () => {
  it('should reject a negative offset', async () => {
    const dto = plainToInstance(IAccountMessagesListQueryDTO, {
      per_page: 10,
      sort: 'created_at',
      offset: -1,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'offset')).toBe(true);
  });

  it('should accept a zero offset', async () => {
    const dto = plainToInstance(IAccountMessagesListQueryDTO, {
      per_page: 10,
      sort: 'created_at',
      offset: 0,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'offset')).toBe(false);
  });
});
