import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  IAreaCreateDTO,
  IAreasListQueryDTO,
  IAreaTicketsListQueryDTO,
  IAreaUpdateDTO,
} from './areas.dto';

describe('IAreasListQueryDTO', () => {
  it('should accept a supported sort value', async () => {
    const dto = plainToInstance(IAreasListQueryDTO, {
      per_page: 10,
      sort: '-alias',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject a sort value outside the allowed list', async () => {
    const dto = plainToInstance(IAreasListQueryDTO, {
      per_page: 10,
      sort: 'description',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'sort')).toBe(true);
  });

  it('should reject a negative offset', async () => {
    const dto = plainToInstance(IAreasListQueryDTO, {
      per_page: 10,
      sort: 'alias',
      offset: -1,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'offset')).toBe(true);
  });
});

describe('IAreaTicketsListQueryDTO', () => {
  it('should accept sorting by subject', async () => {
    const dto = plainToInstance(IAreaTicketsListQueryDTO, {
      per_page: 30,
      sort: 'subject',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject sorting by state', async () => {
    const dto = plainToInstance(IAreaTicketsListQueryDTO, {
      per_page: 30,
      sort: 'state',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'sort')).toBe(true);
  });
});

describe('IAreaCreateDTO', () => {
  const valid = {
    alias: 'Support',
    description: 'First line support',
    logins: ['018f2e2e-7c3a-7c3a-89ab-1234567890ab'],
  };

  it('should accept a well-formed payload', async () => {
    const errors = await validate(plainToInstance(IAreaCreateDTO, valid));

    expect(errors).toHaveLength(0);
  });

  it('should reject an empty logins array', async () => {
    const dto = plainToInstance(IAreaCreateDTO, { ...valid, logins: [] });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'logins')).toBe(true);
  });

  it('should reject a login id that is not a uuid', async () => {
    const dto = plainToInstance(IAreaCreateDTO, {
      ...valid,
      logins: ['not-a-uuid'],
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'logins')).toBe(true);
  });

  it('should reject an alias longer than 100 characters', async () => {
    const dto = plainToInstance(IAreaCreateDTO, {
      ...valid,
      alias: 'a'.repeat(101),
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'alias')).toBe(true);
  });
});

describe('IAreaUpdateDTO', () => {
  it('should accept a payload carrying only the description', async () => {
    const dto = plainToInstance(IAreaUpdateDTO, {
      description: 'Second line support',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an empty logins array when the key is present', async () => {
    const dto = plainToInstance(IAreaUpdateDTO, { logins: [] });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'logins')).toBe(true);
  });
});
