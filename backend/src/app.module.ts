import { AccountModule } from '@app/account';
import { AreasModule } from '@app/areas';
import { AuthModule, JwtAuthGuard, RoleGuard } from '@app/auth';
import { CacheModule } from '@app/cache';
import { DatabaseModule } from '@app/database';
import { TicketsModule } from '@app/tickets';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { config } from '../configuration/configuration';
import { AreasController } from './controllers/areas/areas.controller';
import { AreasControllerService } from './controllers/areas/areas.service';
import { AccountController } from './controllers/account/account.controller';
import { AccountControllerService } from './controllers/account/account.service';
import { TicketsController } from './controllers/tickets/tickets.controller';
import { TicketsControllerService } from './controllers/tickets/tickets.service';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', '../.env'],
      load: [config],
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      useFactory: (cs: ConfigService) => {
        const secret = cs.get<string>('JWT_SECRET');
        if (!secret) throw new Error('invalid_jwt_secret');

        return {
          secret: cs.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: 60 * 5,
          },
        };
      },
      global: true,
      inject: [ConfigService],
    }),
    DatabaseModule,
    CacheModule,
    AuthModule,
    AccountModule,
    AreasModule,
    TicketsModule,
  ],
  controllers: [AccountController, AreasController, TicketsController],
  providers: [
    AccountControllerService,
    AreasControllerService,
    TicketsControllerService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
  ],
})
export class AppModule {}
