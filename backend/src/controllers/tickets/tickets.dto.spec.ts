import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ITicketCreateDTO,
  ITicketIdParamDTO,
  ITicketMessageCreateDTO,
  ITicketsListQueryDTO,
  ITicketUpdateDTO,
} from './tickets.dto';

const ticketId = '019538c4-2f7a-7c31-9c1b-000000000001';

const check = async <T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<string[]> => {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance as object);
  return errors.map((error) => error.property);
};

describe('tickets DTOs', () => {
  describe('ITicketIdParamDTO', () => {
    it('should accept a version 7 uuid', async () => {
      await expect(check(ITicketIdParamDTO, { id: ticketId })).resolves.toEqual(
        [],
      );
    });

    it('should reject a zero-filled placeholder', async () => {
      await expect(
        check(ITicketIdParamDTO, {
          id: '00000000-0000-0000-0000-000000000001',
        }),
      ).resolves.toEqual(['id']);
    });
  });

  describe('ITicketsListQueryDTO', () => {
    it('should accept the minimum query', async () => {
      await expect(
        check(ITicketsListQueryDTO, { per_page: 10, sort: '-created_at' }),
      ).resolves.toEqual([]);
    });

    it('should normalise a single state into an array', async () => {
      const instance = plainToInstance(ITicketsListQueryDTO, {
        per_page: 10,
        sort: 'created_at',
        state: 'NEW',
      });

      expect(instance.state).toEqual(['NEW']);
      await expect(validate(instance)).resolves.toEqual([]);
    });

    it('should reject an unknown state', async () => {
      await expect(
        check(ITicketsListQueryDTO, {
          per_page: 10,
          sort: 'created_at',
          state: ['ARCHIVED'],
        }),
      ).resolves.toEqual(['state']);
    });

    it('should reject a per_page outside the allowed set', async () => {
      await expect(
        check(ITicketsListQueryDTO, { per_page: 7, sort: 'created_at' }),
      ).resolves.toEqual(['per_page']);
    });

    it('should reject an unknown sort column', async () => {
      await expect(
        check(ITicketsListQueryDTO, { per_page: 10, sort: 'description' }),
      ).resolves.toEqual(['sort']);
    });
  });

  describe('ITicketCreateDTO', () => {
    it('should accept subject and description without an area', async () => {
      await expect(
        check(ITicketCreateDTO, {
          subject: 'Printer is down',
          description: 'Third floor printer stopped responding',
        }),
      ).resolves.toEqual([]);
    });

    it('should reject a subject longer than the column', async () => {
      await expect(
        check(ITicketCreateDTO, {
          subject: 'x'.repeat(201),
          description: 'body',
        }),
      ).resolves.toEqual(['subject']);
    });

    it('should reject a missing description', async () => {
      await expect(
        check(ITicketCreateDTO, { subject: 'Printer is down' }),
      ).resolves.toEqual(['description']);
    });
  });

  describe('ITicketUpdateDTO', () => {
    it('should accept an empty object at the DTO layer', async () => {
      await expect(check(ITicketUpdateDTO, {})).resolves.toEqual([]);
    });

    it('should accept a state and a priority', async () => {
      await expect(
        check(ITicketUpdateDTO, { state: 'RESOLVED', priority: 'URGENT' }),
      ).resolves.toEqual([]);
    });

    it('should reject an unknown priority', async () => {
      await expect(
        check(ITicketUpdateDTO, { priority: 'BLOCKER' }),
      ).resolves.toEqual(['priority']);
    });
  });

  describe('ITicketMessageCreateDTO', () => {
    it('should accept a message on its own', async () => {
      await expect(
        check(ITicketMessageCreateDTO, { message: 'still down' }),
      ).resolves.toEqual([]);
    });

    it('should accept a message carrying a state', async () => {
      await expect(
        check(ITicketMessageCreateDTO, {
          message: 'looking into it',
          state: 'WAITING_FEEDBACK',
        }),
      ).resolves.toEqual([]);
    });

    it('should reject a missing message', async () => {
      await expect(check(ITicketMessageCreateDTO, {})).resolves.toEqual([
        'message',
      ]);
    });

    it('should reject an empty message', async () => {
      await expect(
        check(ITicketMessageCreateDTO, { message: '' }),
      ).resolves.toEqual(['message']);
    });

    it('should reject a message past the length cap', async () => {
      await expect(
        check(ITicketMessageCreateDTO, { message: 'a'.repeat(5001) }),
      ).resolves.toEqual(['message']);
    });

    it('should accept a message at the length cap', async () => {
      await expect(
        check(ITicketMessageCreateDTO, { message: 'a'.repeat(5000) }),
      ).resolves.toEqual([]);
    });

    it('should reject an unknown state', async () => {
      await expect(
        check(ITicketMessageCreateDTO, {
          message: 'still down',
          state: 'CLOSED',
        }),
      ).resolves.toEqual(['state']);
    });
  });
});
