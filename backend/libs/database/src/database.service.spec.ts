import {
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../prisma/generated/client';
import { DatabaseService } from './database.service';

const knownError = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError(`prisma failed with ${code}`, {
    code,
    clientVersion: 'test',
  });

describe('DatabaseService', () => {
  let service: DatabaseService;
  let error: jest.SpyInstance;

  beforeEach(async () => {
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockReturnValue('postgresql://user:pass@localhost:5432/test'),
          },
        },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should read the connection string from the configuration', () => {
    const config = { get: jest.fn().mockReturnValue('postgresql://x/y') };

    new DatabaseService(config as never);

    expect(config.get).toHaveBeenCalledWith('DATABASE.URL');
  });

  describe('errorHandler', () => {
    it('should swallow P2025 without logging, so a missing record reads as no result', () => {
      expect(() => service.errorHandler(knownError('P2025'))).not.toThrow();
      expect(error).not.toHaveBeenCalled();
    });

    it('should raise a 409 on P2002 so a duplicate surfaces as a conflict', () => {
      expect(() => service.errorHandler(knownError('P2002'))).toThrow(
        ConflictException,
      );
    });

    it('should name the duplicate on the 409', () => {
      expect(() => service.errorHandler(knownError('P2002'))).toThrow(
        'duplicated_data',
      );
    });

    it('should log and swallow a foreign key violation rather than raising', () => {
      expect(() => service.errorHandler(knownError('P2003'))).not.toThrow();
      expect(error).toHaveBeenCalledWith(
        '[PRISMA ERROR] - CODE:P2003',
        expect.anything(),
      );
    });

    it.each(['P2000', 'P2011', 'P2014'])(
      'should log and swallow the known Prisma code %s',
      (code) => {
        expect(() => service.errorHandler(knownError(code))).not.toThrow();
        expect(error).toHaveBeenCalledWith(
          `[PRISMA ERROR] - CODE:${code}`,
          expect.anything(),
        );
      },
    );

    it('should carry the caller data into the log for a known code', () => {
      const err = knownError('P2003');
      const data = { login_id: 'missing' };

      service.errorHandler(err, data);

      expect(error).toHaveBeenCalledWith(
        '[PRISMA ERROR] - CODE:P2003',
        expect.objectContaining({ err, data }),
      );
    });

    it('should raise a 500 for an error Prisma does not recognise', () => {
      expect(() => service.errorHandler(new Error('socket hang up'))).toThrow(
        InternalServerErrorException,
      );
    });

    it('should log the stack of an unrecognised error before raising', () => {
      const err = new Error('socket hang up');

      expect(() => service.errorHandler(err)).toThrow();
      expect(error).toHaveBeenCalledWith('[PRISMA UNKNOWN ERROR]', err.stack);
    });
  });
});
