import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database.service';
import { LoginRepository } from './repository.service';

describe('LoginRepository', () => {
  let repository: LoginRepository;
  let database: {
    login: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    errorHandler: jest.Mock;
  };

  const loginId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    database = {
      login: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      errorHandler: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginRepository,
        { provide: DatabaseService, useValue: database },
      ],
    }).compile();

    repository = module.get(LoginRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('createOne', () => {
    const params = {
      username: 'admin',
      password: 'hash',
      email: 'a@b.com',
      created_at: new Date(),
    };

    it('should call login.create with the params and return the created row', async () => {
      const expected = { id: loginId };
      database.login.create.mockResolvedValue(expected);

      const result = await repository.createOne(params);

      expect(database.login.create).toHaveBeenCalledWith({
        data: params,
        select: { id: true },
      });
      expect(result).toBe(expected);
    });

    it('should delegate Prisma errors to errorHandler and return undefined when handler swallows', async () => {
      const error = new Error('prisma');
      database.login.create.mockRejectedValue(error);
      database.errorHandler.mockReturnValue(undefined);

      const result = await repository.createOne(params);

      expect(database.errorHandler).toHaveBeenCalledWith(error);
      expect(result).toBeUndefined();
    });
  });

  describe('findOneById', () => {
    it('should call login.findUnique with the id and return the row', async () => {
      const expected = { id: loginId, password: 'hash' };
      database.login.findUnique.mockResolvedValue(expected);

      const result = await repository.findOneById(loginId);

      expect(database.login.findUnique).toHaveBeenCalledWith({
        where: { id: loginId },
        select: { id: true, password: true },
      });
      expect(result).toBe(expected);
    });
  });

  describe('findOneByUsernameOrEmail', () => {
    it('should call login.findFirst with the params and return the row', async () => {
      const params = { username: 'admin' };
      const expected = { id: loginId, password: 'hash' };
      database.login.findFirst.mockResolvedValue(expected);

      const result = await repository.findOneByUsernameOrEmail(params);

      expect(database.login.findFirst).toHaveBeenCalledWith({
        where: params,
        select: { id: true, password: true },
      });
      expect(result).toBe(expected);
    });
  });

  describe('updatePasswordById', () => {
    it('should call login.update with the new hash and where id', async () => {
      const expected = { id: loginId };
      database.login.update.mockResolvedValue(expected);

      const result = await repository.updatePasswordById({
        loginId,
        passwordHash: 'new-hash',
      });

      expect(database.login.update).toHaveBeenCalledWith({
        data: { password: 'new-hash' },
        where: { id: loginId },
        select: { id: true },
      });
      expect(result).toBe(expected);
    });
  });
});
