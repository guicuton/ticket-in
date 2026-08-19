import { AccountModule } from '@app/account';
import { AuthModule } from '@app/auth';
import { CacheModule } from '@app/cache';
import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { config } from '../configuration/configuration';
import { AreasController } from './controllers/areas/app.controller';
import { AccountController } from './controllers/account/account.controller';
import { AccountControllerService } from './controllers/account/account.service';
import { JwtModule } from '@nestjs/jwt';

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
  ],
  controllers: [AccountController, AreasController],
  providers: [AccountControllerService],
})
export class AppModule {}
