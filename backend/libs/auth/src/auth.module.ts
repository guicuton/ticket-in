import { AccountModule } from '@app/account';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt.guard';
import { LocalAuthGuard } from './guards/local.guard';
import { AuthStrategyJwt } from './strategies/jwt.strategy';
import { AuthStrategyLocal } from './strategies/local.strategy';

@Module({
  imports: [PassportModule, AccountModule],
  providers: [
    AuthService,
    LocalAuthGuard,
    JwtAuthGuard,
    AuthStrategyLocal,
    AuthStrategyJwt,
  ],
  exports: [
    AuthService,
    LocalAuthGuard,
    JwtAuthGuard,
    AuthStrategyLocal,
    AuthStrategyJwt,
  ],
})
export class AuthModule {}
