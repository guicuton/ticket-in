import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { LoginsRepository } from './repositories/logins/repository.service';
import { TicketsRepository } from './repositories/tickets/repository.service';
import { TicketMessagesRepository } from './repositories/ticket-messages/repository.service';
import { AreasRepository } from './repositories/areas/repository.service';

@Global()
@Module({
  providers: [
    DatabaseService,
    LoginsRepository,
    TicketsRepository,
    TicketMessagesRepository,
    AreasRepository,
  ],
  exports: [
    DatabaseService,
    LoginsRepository,
    TicketsRepository,
    TicketMessagesRepository,
    AreasRepository,
  ],
})
export class DatabaseModule {}
