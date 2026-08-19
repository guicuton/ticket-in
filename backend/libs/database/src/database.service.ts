import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../prisma/generated/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@Inject(ConfigService) cs: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: cs.get<string>('DATABASE.URL'),
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  errorHandler(err: Error, data?: unknown): void {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') return;
      if (err.code === 'P2002') throw new ConflictException('duplicated_data');
      this.logger.error(`[PRISMA ERROR] - CODE:${err.code}`, {
        err,
        data,
      });
      return;
    } else {
      this.logger.error('[PRISMA UNKNOWN ERROR]', err?.stack);
      throw new InternalServerErrorException('CONTACT ADMIN SERVER');
    }
  }
}
