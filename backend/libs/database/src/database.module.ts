import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { LoginsRepository } from './repositories/logins/repository.service';

@Global()
@Module({
  providers: [DatabaseService, LoginsRepository],
  exports: [DatabaseService, LoginsRepository],
})
export class DatabaseModule {}
